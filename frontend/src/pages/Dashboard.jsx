import React, { useEffect, useState } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Typography, 
  Spin, 
  List, 
  Tag, 
  Button, 
  Space,
  Empty,
  Divider,
  Tooltip
} from 'antd';
import {
  DatabaseOutlined,
  CodeOutlined,
  CheckCircleOutlined,
  UserOutlined,
  TrophyOutlined,
  BookOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  RocketOutlined,
  FileTextOutlined,
  LinkOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const Dashboard = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [myStats, setMyStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, myStatsRes, activityRes] = await Promise.all([
        api.get('/stats/overall'),
        api.get('/stats/my-stats'),
        api.get('/stats/recent-activity?limit=5')
      ]);
      setStats(statsRes.data);
      setMyStats(myStatsRes.data);
      setRecentActivity(activityRes.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
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

  const getStatusColor = (status) => {
    const colors = {
      'reserved': 'green',
      'released': 'default',
      'failed': 'red',
      'expired': 'orange'
    };
    return colors[status] || 'default';
  };

  return (
    <div style={{ padding: '24px', background: '#0f172a', minHeight: '100vh' }}>
      <Title level={2} style={{ color: 'rgb(241, 245, 249)', marginBottom: 8 }}>
        Welcome back, {user?.username}! 👋
      </Title>
      <Text style={{ color: 'rgb(148, 163, 184)', fontSize: 14, marginBottom: 24, display: 'block' }}>
        Here's what's happening with your Habitat tasks
      </Text>

      {/* Overall Statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 12
            }}
            bodyStyle={{ padding: '20px' }}
          >
            <Statistic
              title={<span style={{ color: 'rgb(148, 163, 184)' }}>Total Commits</span>}
              value={stats?.commits?.total || 0}
              prefix={<CodeOutlined style={{ color: '#16a34a' }} />}
              valueStyle={{ color: '#16a34a', fontSize: 28, fontWeight: 600 }}
            />
            {stats?.commits?.highScore > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'rgb(148, 163, 184)' }}>
                {stats.commits.highScore} high-score (≥100)
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 12
            }}
            bodyStyle={{ padding: '20px' }}
          >
            <Statistic
              title={<span style={{ color: 'rgb(148, 163, 184)' }}>My Reservations</span>}
              value={myStats?.reservations?.active || 0}
              prefix={<CheckCircleOutlined style={{ color: '#16a34a' }} />}
              valueStyle={{ color: '#16a34a', fontSize: 28, fontWeight: 600 }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: 'rgb(148, 163, 184)' }}>
              {myStats?.reservations?.total || 0} total
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 12
            }}
            bodyStyle={{ padding: '20px' }}
          >
            <Statistic
              title={<span style={{ color: 'rgb(148, 163, 184)' }}>Successful Tasks</span>}
              value={myStats?.successfulTasks?.total || 0}
              prefix={<TrophyOutlined style={{ color: '#f59e0b' }} />}
              valueStyle={{ color: '#f59e0b', fontSize: 28, fontWeight: 600 }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: 'rgb(148, 163, 184)' }}>
              {stats?.successfulTasks?.total || 0} team total
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 12
            }}
            bodyStyle={{ padding: '20px' }}
          >
            <Statistic
              title={<span style={{ color: 'rgb(148, 163, 184)' }}>Memo Commits</span>}
              value={myStats?.memoCommits?.total || 0}
              prefix={<BookOutlined style={{ color: '#8b5cf6' }} />}
              valueStyle={{ color: '#8b5cf6', fontSize: 28, fontWeight: 600 }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: 'rgb(148, 163, 184)' }}>
              {stats?.memoCommits?.total || 0} total
            </div>
          </Card>
        </Col>
      </Row>

      {/* Admin Stats Row */}
      {isAdmin() && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 12
              }}
              bodyStyle={{ padding: '20px' }}
            >
              <Statistic
                title={<span style={{ color: 'rgb(148, 163, 184)' }}>Repositories</span>}
                value={stats?.repos?.active || 0}
                prefix={<DatabaseOutlined style={{ color: '#3b82f6' }} />}
                valueStyle={{ color: '#3b82f6', fontSize: 28, fontWeight: 600 }}
              />
              <div style={{ marginTop: 8, fontSize: 12, color: 'rgb(148, 163, 184)' }}>
                {stats?.repos?.total || 0} total
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 12
              }}
              bodyStyle={{ padding: '20px' }}
            >
              <Statistic
                title={<span style={{ color: 'rgb(148, 163, 184)' }}>Users</span>}
                value={stats?.users?.total || 0}
                prefix={<UserOutlined style={{ color: '#3b82f6' }} />}
                valueStyle={{ color: '#3b82f6', fontSize: 28, fontWeight: 600 }}
              />
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 12
              }}
              bodyStyle={{ padding: '20px' }}
            >
              <Statistic
                title={<span style={{ color: 'rgb(148, 163, 184)' }}>Habitat Accounts</span>}
                value={stats?.accounts?.active || 0}
                prefix={<RocketOutlined style={{ color: '#3b82f6' }} />}
                valueStyle={{ color: '#3b82f6', fontSize: 28, fontWeight: 600 }}
              />
              <div style={{ marginTop: 8, fontSize: 12, color: 'rgb(148, 163, 184)' }}>
                {stats?.accounts?.total || 0} total
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 12
              }}
              bodyStyle={{ padding: '20px' }}
            >
              <Statistic
                title={<span style={{ color: 'rgb(148, 163, 184)' }}>All Reservations</span>}
                value={stats?.reservations?.active || 0}
                prefix={<CheckCircleOutlined style={{ color: '#16a34a' }} />}
                valueStyle={{ color: '#16a34a', fontSize: 28, fontWeight: 600 }}
              />
              <div style={{ marginTop: 8, fontSize: 12, color: 'rgb(148, 163, 184)' }}>
                {stats?.reservations?.total || 0} total
              </div>
            </Card>
          </Col>
        </Row>
      )}

      {/* Recent Activity */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <ClockCircleOutlined />
                <span style={{ color: 'rgb(241, 245, 249)' }}>Recent Reservations</span>
              </Space>
            }
            extra={
              <Button 
                type="link" 
                onClick={() => navigate('/reservations')}
                style={{ color: '#16a34a', padding: 0 }}
              >
                View All <ArrowRightOutlined />
              </Button>
            }
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 12
            }}
            bodyStyle={{ padding: '16px' }}
          >
            {recentActivity?.reservations?.length > 0 ? (
              <List
                dataSource={recentActivity.reservations}
                renderItem={(reservation) => (
                  <List.Item
                    style={{
                      borderColor: '#334155',
                      padding: '12px 0'
                    }}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <Text style={{ color: 'rgb(241, 245, 249)', fontSize: 13 }}>
                            {reservation.commit?.repo?.fullName || reservation.commit?.repo?.repoName || 'Unknown Repo'}
                          </Text>
                          <Tag color={getStatusColor(reservation.status)}>
                            {reservation.status}
                          </Tag>
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={4} style={{ width: '100%' }}>
                          <Text style={{ color: 'rgb(148, 163, 184)', fontSize: 12 }}>
                            {reservation.commit?.message?.substring(0, 60) || 'No message'}...
                          </Text>
                          <Text style={{ color: 'rgb(100, 116, 139)', fontSize: 11 }}>
                            {dayjs(reservation.createdAt).fromNow()}
                            {reservation.commit?.habitateScore && (
                              <> • Score: <Text style={{ color: '#16a34a' }}>{reservation.commit.habitateScore}</Text></>
                            )}
                          </Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty 
                description={<span style={{ color: 'rgb(148, 163, 184)' }}>No recent reservations</span>}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <TrophyOutlined />
                <span style={{ color: 'rgb(241, 245, 249)' }}>Recent Successful Tasks</span>
              </Space>
            }
            extra={
              <Button 
                type="link" 
                onClick={() => navigate('/successful-tasks')}
                style={{ color: '#16a34a', padding: 0 }}
              >
                View All <ArrowRightOutlined />
              </Button>
            }
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 12
            }}
            bodyStyle={{ padding: '16px' }}
          >
            {recentActivity?.tasks?.length > 0 ? (
              <List
                dataSource={recentActivity.tasks}
                renderItem={(task) => (
                  <List.Item
                    style={{
                      borderColor: '#334155',
                      padding: '12px 0'
                    }}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <Text style={{ color: 'rgb(241, 245, 249)', fontSize: 13 }}>
                            {task.taskName}
                          </Text>
                          {task.payoutAmount && (
                            <Tag color="green" icon={<DollarOutlined />}>
                              ${task.payoutAmount}
                            </Tag>
                          )}
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={4} style={{ width: '100%' }}>
                          <Text style={{ color: 'rgb(148, 163, 184)', fontSize: 12 }}>
                            {task.commit?.repo?.fullName || task.commit?.repo?.repoName || 'Unknown Repo'}
                          </Text>
                          <Text style={{ color: 'rgb(100, 116, 139)', fontSize: 11 }}>
                            {dayjs(task.createdAt).fromNow()}
                            {task.aiSuccessRate && (
                              <> • AI Success: <Text style={{ color: '#f59e0b' }}>{task.aiSuccessRate}%</Text></>
                            )}
                          </Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty 
                description={<span style={{ color: 'rgb(148, 163, 184)' }}>No successful tasks yet</span>}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Quick Actions */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24}>
          <Card
            title={
              <Space>
                <RocketOutlined />
                <span style={{ color: 'rgb(241, 245, 249)' }}>Quick Actions</span>
              </Space>
            }
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 12
            }}
            bodyStyle={{ padding: '16px' }}
          >
            <Space wrap>
              <Button
                type="primary"
                icon={<CodeOutlined />}
                size="large"
                onClick={() => navigate('/commits')}
                style={{
                  background: '#16a34a',
                  borderColor: '#16a34a',
                  height: 48
                }}
              >
                Browse Commits
              </Button>
              <Button
                icon={<CheckCircleOutlined />}
                size="large"
                onClick={() => navigate('/reservations')}
                style={{
                  background: '#334155',
                  borderColor: '#334155',
                  color: 'rgb(241, 245, 249)',
                  height: 48
                }}
              >
                My Reservations
              </Button>
              <Button
                icon={<TrophyOutlined />}
                size="large"
                onClick={() => navigate('/successful-tasks')}
                style={{
                  background: '#334155',
                  borderColor: '#334155',
                  color: 'rgb(241, 245, 249)',
                  height: 48
                }}
              >
                Successful Tasks
              </Button>
              <Button
                icon={<BookOutlined />}
                size="large"
                onClick={() => navigate('/memo')}
                style={{
                  background: '#334155',
                  borderColor: '#334155',
                  color: 'rgb(241, 245, 249)',
                  height: 48
                }}
              >
                My Memo
              </Button>
              {isAdmin() && (
                <>
                  <Button
                    icon={<UserOutlined />}
                    size="large"
                    onClick={() => navigate('/admin/users')}
                    style={{
                      background: '#334155',
                      borderColor: '#334155',
                      color: 'rgb(241, 245, 249)',
                      height: 48
                    }}
                  >
                    User Management
                  </Button>
                  <Button
                    icon={<DatabaseOutlined />}
                    size="large"
                    onClick={() => navigate('/admin/repos')}
                    style={{
                      background: '#334155',
                      borderColor: '#334155',
                      color: 'rgb(241, 245, 249)',
                      height: 48
                    }}
                  >
                    Repo Management
                  </Button>
                  <Button
                    icon={<RocketOutlined />}
                    size="large"
                    onClick={() => navigate('/admin/accounts')}
                    style={{
                      background: '#334155',
                      borderColor: '#334155',
                      color: 'rgb(241, 245, 249)',
                      height: 48
                    }}
                  >
                    Account Management
                  </Button>
                </>
              )}
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
