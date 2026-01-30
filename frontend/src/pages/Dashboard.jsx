import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Typography, Spin } from 'antd';
import {
  DatabaseOutlined,
  CodeOutlined,
  CheckCircleOutlined,
  UserOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';

const { Title } = Typography;

const Dashboard = () => {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await api.get('/stats/overall');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Title level={2} style={{ color: 'rgb(241, 245, 249)', marginBottom: 24 }}>
        Welcome back, {user?.username}!
      </Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Repositories"
              value={stats?.repos?.total || 0}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#16a34a' }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: 'rgb(148, 163, 184)' }}>
              {stats?.repos?.active || 0} active
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Commits"
              value={stats?.commits?.total || 0}
              prefix={<CodeOutlined />}
              valueStyle={{ color: '#16a34a' }}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Reservations"
              value={stats?.reservations?.total || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#16a34a' }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: 'rgb(148, 163, 184)' }}>
              {stats?.reservations?.active || 0} active
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Successful Tasks"
              value={stats?.successfulTasks?.total || 0}
              prefix={<TrophyOutlined />}
              valueStyle={{ color: '#16a34a' }}
            />
          </Card>
        </Col>

        {isAdmin() && (
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Users"
                value={stats?.users?.total || 0}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#16a34a' }}
              />
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
};

export default Dashboard;
