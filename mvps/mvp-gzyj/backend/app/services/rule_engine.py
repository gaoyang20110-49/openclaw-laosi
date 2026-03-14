"""规则引擎服务 - 场景A/B判定逻辑"""
from datetime import datetime, timedelta
from typing import List, Tuple, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_

from app.models import AlertRule, ValveRegistry, TimeseriesData, AlertIncident
from app.services.time_service import TimeService


class RuleEngine:
    """规则引擎"""
    
    def __init__(self, db: Session):
        self.db = db
        self.time_service = TimeService(db)
    
    def run(self) -> Dict[str, Any]:
        """
        运行规则引擎
        
        遍历所有启用的规则，对每个符合条件的阀门执行判定
        
        Returns:
            执行统计信息
        """
        effective_now = self.time_service.get_effective_now()
        
        # 获取所有启用的规则
        rules = self.db.query(AlertRule).filter(
            AlertRule.enabled == True
        ).all()
        
        stats = {
            "rules_evaluated": 0,
            "valves_checked": 0,
            "incidents_triggered": 0,
            "incidents_resolved": 0
        }
        
        for rule in rules:
            stats["rules_evaluated"] += 1
            
            # 获取该规则覆盖的阀门
            valves = self._get_valves_for_rule(rule)
            
            for valve in valves:
                stats["valves_checked"] += 1
                
                # 执行判定
                is_triggered = self._evaluate_rule(rule, valve, effective_now)
                
                # 处理结果
                if is_triggered:
                    triggered = self._handle_trigger(rule, valve, effective_now)
                    if triggered:
                        stats["incidents_triggered"] += 1
                else:
                    resolved = self._handle_recovery(rule, valve, effective_now)
                    if resolved:
                        stats["incidents_resolved"] += 1
        
        return stats
    
    def _get_valves_for_rule(self, rule: AlertRule) -> List[ValveRegistry]:
        """
        获取规则覆盖的阀门列表
        
        前置条件：机房匹配 + 阀门重要性匹配
        """
        query = self.db.query(ValveRegistry)
        
        # 机房筛选
        if rule.site_code:
            query = query.filter(ValveRegistry.site_code == rule.site_code)
        
        # 重要性筛选
        if rule.importance_filter == 'important':
            query = query.filter(ValveRegistry.is_important == True)
        elif rule.importance_filter == 'normal':
            query = query.filter(ValveRegistry.is_important == False)
        # 'all' 不做筛选
        
        # 阀门类型筛选（如果有）
        if rule.valve_type_filter:
            query = query.filter(ValveRegistry.valve_type == rule.valve_type_filter)
        
        return query.all()
    
    def _evaluate_rule(self, rule: AlertRule, valve: ValveRegistry, 
                       effective_now: datetime) -> bool:
        """
        对单个阀门执行规则判定
        
        Returns:
            True: 触发预警
            False: 未触发（或已恢复）
        """
        if rule.scene_type == 'A':
            return self._evaluate_scene_a(rule, valve, effective_now)
        elif rule.scene_type == 'B':
            return self._evaluate_scene_b(rule, valve, effective_now)
        
        return False
    
    def _evaluate_scene_a(self, rule: AlertRule, valve: ValveRegistry,
                          effective_now: datetime) -> bool:
        """
        场景A判定：持续高位预警
        
        PRD v1.5: 条件1（点数）OR 条件2（时长），满足任一即触发
        
        条件1：连续 n_points 个点 PV >= threshold
        条件2：连续点 PV >= threshold 且时间跨度 >= n_minutes
        """
        params = rule.params
        n_points = params.get('n_points', 5)
        n_minutes = params.get('n_minutes', 5)
        threshold = params.get('threshold', 80)
        
        # 查询时间窗口内的数据
        window_start = effective_now - timedelta(minutes=n_minutes * 2)
        
        rows = self.db.query(TimeseriesData).filter(
            TimeseriesData.site_code == valve.site_code,
            TimeseriesData.valve_id == valve.valve_id,
            TimeseriesData.timestamp >= window_start,
            TimeseriesData.timestamp <= effective_now
        ).order_by(TimeseriesData.timestamp).all()
        
        if len(rows) < 2:
            return False
        
        # 找连续满足阈值的点序列
        consecutive_sequences = self._find_consecutive_sequences(
            rows, threshold, operator='ge'
        )
        
        # 条件1: 存在连续 n_points 个点满足阈值
        for seq in consecutive_sequences:
            if len(seq) >= n_points:
                return True  # 条件1满足，触发
        
        # 条件2: 存在连续点满足阈值，且时间跨度 >= n_minutes
        for seq in consecutive_sequences:
            if len(seq) >= 2:  # 至少2个点才能计算时间跨度
                time_span = (seq[-1].timestamp - seq[0].timestamp).total_seconds() / 60
                if time_span >= n_minutes:
                    return True  # 条件2满足，触发
        
        return False  # 两个条件都不满足
    
    def _evaluate_scene_b(self, rule: AlertRule, valve: ValveRegistry,
                          effective_now: datetime) -> bool:
        """
        场景B判定：短时间内剧烈波动
        
        窗口内 max(pv_value) - min(pv_value) >= delta_threshold
        允许跨断点，非连续点可参与计算
        """
        params = rule.params
        window_minutes = params.get('window_minutes', 10)
        delta_threshold = params.get('delta_threshold', 20)
        
        window_start = effective_now - timedelta(minutes=window_minutes)
        
        # 查询窗口内所有数据（包括断点）
        rows = self.db.query(TimeseriesData).filter(
            TimeseriesData.site_code == valve.site_code,
            TimeseriesData.valve_id == valve.valve_id,
            TimeseriesData.timestamp >= window_start,
            TimeseriesData.timestamp <= effective_now
        ).all()
        
        if len(rows) < 2:
            return False
        
        # 计算 max - min
        pv_values = [float(r.pv_value) for r in rows]
        max_pv = max(pv_values)
        min_pv = min(pv_values)
        delta = max_pv - min_pv
        
        return delta >= delta_threshold
    
    def _find_consecutive_sequences(self, rows: List[TimeseriesData], 
                                    threshold: float, 
                                    operator: str = 'ge') -> List[List[TimeseriesData]]:
        """
        找出连续满足条件的点序列
        
        Args:
            rows: 按时间排序的数据点列表
            threshold: 阈值
            operator: 'ge'(>=) 或 'lt'(<)
        
        Returns:
            连续序列列表
        """
        sequences = []
        current_seq = []
        
        for row in rows:
            pv = float(row.pv_value)
            
            if operator == 'ge':
                condition = pv >= threshold
            else:
                condition = pv < threshold
            
            if condition:
                current_seq.append(row)
            else:
                if current_seq:
                    sequences.append(current_seq)
                    current_seq = []
        
        # 不要忘记最后一个序列
        if current_seq:
            sequences.append(current_seq)
        
        return sequences
    
    def _handle_trigger(self, rule: AlertRule, valve: ValveRegistry,
                        effective_now: datetime) -> bool:
        """
        处理触发事件
        
        Returns:
            True: 创建了新事件
            False: 追加了持续日志
        """
        from app.models import AlertEventLog, AlertRecord
        
        # 查找当前活跃事件
        active_incident = self.db.query(AlertIncident).filter(
            AlertIncident.rule_id == rule.id,
            AlertIncident.site_code == valve.site_code,
            AlertIncident.valve_id == valve.valve_id,
            AlertIncident.status == 'active'
        ).first()
        
        # 获取当前PV值
        latest = self.db.query(TimeseriesData).filter(
            TimeseriesData.site_code == valve.site_code,
            TimeseriesData.valve_id == valve.valve_id
        ).order_by(desc(TimeseriesData.timestamp)).first()
        
        pv_value = float(latest.pv_value) if latest else None
        
        if active_incident:
            # 已有活跃事件，追加持续日志
            log = AlertEventLog(
                incident_id=active_incident.id,
                event_type='ongoing',
                event_time=effective_now,
                pv_value=pv_value
            )
            self.db.add(log)
            
            # 更新事件信息
            active_incident.last_triggered_at = effective_now
            active_incident.trigger_count += 1
            active_incident.current_pv_value = pv_value
            
            self.db.commit()
            return False
        else:
            # 创建新事件
            incident = AlertIncident(
                rule_id=rule.id,
                site_code=valve.site_code,
                valve_id=valve.valve_id,
                status='active',
                first_triggered_at=effective_now,
                last_triggered_at=effective_now,
                trigger_count=1,
                current_pv_value=pv_value
            )
            self.db.add(incident)
            self.db.flush()  # 获取ID
            
            # 添加触发日志
            log = AlertEventLog(
                incident_id=incident.id,
                event_type='triggered',
                event_time=effective_now,
                pv_value=pv_value
            )
            self.db.add(log)
            
            # 添加告警记录
            record = AlertRecord(
                incident_id=incident.id,
                rule_id=rule.id,
                site_code=valve.site_code,
                valve_id=valve.valve_id,
                alert_type='triggered',
                alert_time=effective_now,
                pv_value=pv_value
            )
            self.db.add(record)
            
            self.db.commit()
            return True
    
    def _handle_recovery(self, rule: AlertRule, valve: ValveRegistry,
                         effective_now: datetime) -> bool:
        """
        处理恢复事件
        
        Returns:
            True: 事件已恢复
            False: 无活跃事件或未达到恢复条件
        """
        from app.models import AlertEventLog, AlertRecord
        
        # 查找当前活跃事件
        active_incident = self.db.query(AlertIncident).filter(
            AlertIncident.rule_id == rule.id,
            AlertIncident.site_code == valve.site_code,
            AlertIncident.valve_id == valve.valve_id,
            AlertIncident.status == 'active'
        ).first()
        
        if not active_incident:
            return False
        
        # 检查是否满足恢复条件
        if not self._check_recovery_condition(rule, valve, effective_now):
            return False
        
        # 获取当前PV值
        latest = self.db.query(TimeseriesData).filter(
            TimeseriesData.site_code == valve.site_code,
            TimeseriesData.valve_id == valve.valve_id
        ).order_by(desc(TimeseriesData.timestamp)).first()
        
        pv_value = float(latest.pv_value) if latest else None
        
        # 更新事件状态
        active_incident.status = 'recovered'
        active_incident.ended_at = effective_now
        
        # 添加恢复日志
        log = AlertEventLog(
            incident_id=active_incident.id,
            event_type='recovered',
            event_time=effective_now,
            pv_value=pv_value
        )
        self.db.add(log)
        
        # 添加恢复告警记录
        record = AlertRecord(
            incident_id=active_incident.id,
            rule_id=rule.id,
            site_code=valve.site_code,
            valve_id=valve.valve_id,
            alert_type='recovered',
            alert_time=effective_now,
            pv_value=pv_value
        )
        self.db.add(record)
        
        self.db.commit()
        return True
    
    def _check_recovery_condition(self, rule: AlertRule, valve: ValveRegistry,
                                   effective_now: datetime) -> bool:
        """
        检查是否满足恢复条件
        
        PRD v1.5: 恢复条件同样采用 OR 逻辑
        """
        params = rule.params
        
        if rule.scene_type == 'A':
            # 场景A恢复：连续 recover_points 个点 < threshold
            # 或 连续点 < threshold 且时间跨度 >= recover_minutes
            recover_points = params.get('recover_points', 2)
            recover_minutes = params.get('recover_minutes', 2)
            threshold = params.get('threshold', 80)
            
            window_start = effective_now - timedelta(minutes=recover_minutes * 2)
            
            rows = self.db.query(TimeseriesData).filter(
                TimeseriesData.site_code == valve.site_code,
                TimeseriesData.valve_id == valve.valve_id,
                TimeseriesData.timestamp >= window_start,
                TimeseriesData.timestamp <= effective_now
            ).order_by(TimeseriesData.timestamp).all()
            
            if len(rows) < recover_points:
                return False
            
            # 找连续低于阈值的序列
            sequences = self._find_consecutive_sequences(
                rows, threshold, operator='lt'
            )
            
            # 条件1: 连续 recover_points 个点低于阈值
            for seq in sequences:
                if len(seq) >= recover_points:
                    return True
            
            # 条件2: 连续点低于阈值且时间跨度 >= recover_minutes
            for seq in sequences:
                if len(seq) >= 2:
                    time_span = (seq[-1].timestamp - seq[0].timestamp).total_seconds() / 60
                    if time_span >= recover_minutes:
                        return True
            
            return False
            
        elif rule.scene_type == 'B':
            # 场景B恢复：窗口内 max-min < recover_delta_threshold
            window_minutes = params.get('window_minutes', 10)
            delta_threshold = params.get('delta_threshold', 20)
            recover_delta = params.get('recover_delta_threshold', delta_threshold * 0.8)
            
            window_start = effective_now - timedelta(minutes=window_minutes)
            
            rows = self.db.query(TimeseriesData).filter(
                TimeseriesData.site_code == valve.site_code,
                TimeseriesData.valve_id == valve.valve_id,
                TimeseriesData.timestamp >= window_start,
                TimeseriesData.timestamp <= effective_now
            ).all()
            
            if len(rows) < 2:
                return True  # 数据不足，认为已恢复
            
            pv_values = [float(r.pv_value) for r in rows]
            delta = max(pv_values) - min(pv_values)
            
            return delta < recover_delta
        
        return False
