import React, { useEffect, useState } from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Typography, 
  Skeleton, 
  List, 
  Tag, 
  Button, 
  Space,
  Empty
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
  ArrowRightOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import AnimatedNumber from '../components/AnimatedNumber';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const CARD_STYLE = {
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 12,
  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
};

/** Stat block with animated value so count-up always runs (avoids Statistic formatter quirks) */
const StatCard = ({ title, value = 0, prefix, valueStyle, duration = 900, children }) => (
  <>
    <div className="ant-statistic-title" style={{ color: 'rgb(148, 163, 184)', marginBottom: 4 }}>{title}</div>
    <div className="ant-statistic-content" style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 4 }}>
      {prefix && <span className="ant-statistic-content-prefix" style={{ marginRight: 4 }}>{prefix}</span>}
      <span className="ant-statistic-content-value" style={{ ...valueStyle, fontSize: valueStyle?.fontSize ?? 28, fontWeight: 600 }}>
        <AnimatedNumber value={value} duration={duration} />
      </span>
    </div>
    {children}
  </>
);

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
      <div style={{ padding: '24px', background: '#0f172a', minHeight: '100vh' }}>
        <Skeleton active paragraph={{ rows: 1 }} style={{ marginBottom: 24, maxWidth: 400 }} />
        <Row gutter={[16, 16]}>
          {[1, 2, 3, 4].map((i) => (
            <Col xs={24} sm={12} lg={6} key={i}>
              <Card style={{ ...CARD_STYLE }} bodyStyle={{ padding: '20px' }}>
                <Skeleton active title={{ width: '60%' }} paragraph={false} />
                <Skeleton active paragraph={{ rows: 1, width: '40%' }} style={{ marginTop: 16 }} />
              </Card>
            </Col>
          ))}
        </Row>
        <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
          <Col xs={24} lg={12}>
            <Card style={CARD_STYLE} bodyStyle={{ padding: 16 }}>
              <Skeleton active title paragraph={{ rows: 4 }} />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card style={CARD_STYLE} bodyStyle={{ padding: 16 }}>
              <Skeleton active title paragraph={{ rows: 4 }} />
            </Card>
          </Col>
        </Row>
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
      <style>{`
        .dashboard-stat-card {
          cursor: default;
        }
        .dashboard-stat-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 28px rgba(0,0,0,0.3);
          border-color: #475569 !important;
        }
      `}</style>
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
            className="dashboard-stat-card"
            style={CARD_STYLE}
            bodyStyle={{ padding: '20px' }}
          >
            <StatCard
              title="Total Commits"
              value={stats?.commits?.total ?? 0}
              prefix={<CodeOutlined style={{ color: '#16a34a' }} />}
              valueStyle={{ color: '#16a34a' }}
              duration={900}
            >
              {stats?.commits?.highScore > 0 && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'rgb(148, 163, 184)' }}>
                  <AnimatedNumber value={stats.commits.highScore} duration={800} /> high-score (≥100)
                </div>
              )}
            </StatCard>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            className="dashboard-stat-card"
            style={CARD_STYLE}
            bodyStyle={{ padding: '20px' }}
          >
            <StatCard
              title="My Reservations"
              value={myStats?.reservations?.active ?? 0}
              prefix={<CheckCircleOutlined style={{ color: '#16a34a' }} />}
              valueStyle={{ color: '#16a34a' }}
              duration={900}
            >
              <div style={{ marginTop: 8, fontSize: 12, color: 'rgb(148, 163, 184)' }}>
                <AnimatedNumber value={myStats?.reservations?.total ?? 0} duration={700} /> total
              </div>
            </StatCard>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            className="dashboard-stat-card"
            style={CARD_STYLE}
            bodyStyle={{ padding: '20px' }}
          >
            <StatCard
              title="Successful Tasks"
              value={myStats?.successfulTasks?.total ?? 0}
              prefix={<TrophyOutlined style={{ color: '#f59e0b' }} />}
              valueStyle={{ color: '#f59e0b' }}
              duration={900}
            >
              <div style={{ marginTop: 8, fontSize: 12, color: 'rgb(148, 163, 184)' }}>
                <AnimatedNumber value={stats?.successfulTasks?.total ?? 0} duration={700} /> team total
              </div>
            </StatCard>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card
            className="dashboard-stat-card"
            style={CARD_STYLE}
            bodyStyle={{ padding: '20px' }}
          >
            <StatCard
              title="Memo Commits"
              value={myStats?.memoCommits?.total ?? 0}
              prefix={<BookOutlined style={{ color: '#8b5cf6' }} />}
              valueStyle={{ color: '#8b5cf6' }}
              duration={900}
            >
              <div style={{ marginTop: 8, fontSize: 12, color: 'rgb(148, 163, 184)' }}>
                <AnimatedNumber value={stats?.memoCommits?.total ?? 0} duration={700} /> total
              </div>
            </StatCard>
          </Card>
        </Col>
      </Row>

      {/* Admin Stats Row */}
      {isAdmin() && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card className="dashboard-stat-card" style={CARD_STYLE} bodyStyle={{ padding: '20px' }}>
              <StatCard
                title="Repositories"
                value={stats?.repos?.active ?? 0}
                prefix={<DatabaseOutlined style={{ color: '#3b82f6' }} />}
                valueStyle={{ color: '#3b82f6' }}
                duration={900}
              >
                <div style={{ marginTop: 8, fontSize: 12, color: 'rgb(148, 163, 184)' }}>
                  <AnimatedNumber value={stats?.repos?.total ?? 0} duration={700} /> total
                </div>
              </StatCard>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="dashboard-stat-card" style={CARD_STYLE} bodyStyle={{ padding: '20px' }}>
              <StatCard
                title="Users"
                value={stats?.users?.total ?? 0}
                prefix={<UserOutlined style={{ color: '#3b82f6' }} />}
                valueStyle={{ color: '#3b82f6' }}
                duration={900}
              >
                <div style={{ marginTop: 8, fontSize: 12, color: 'rgb(148, 163, 184)' }}>
                  <AnimatedNumber value={stats?.users?.total ?? 0} duration={700} /> total
                </div>
              </StatCard>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="dashboard-stat-card" style={CARD_STYLE} bodyStyle={{ padding: '20px' }}>
              <StatCard
                title="Habitat Accounts"
                value={stats?.accounts?.active ?? 0}
                prefix={<RocketOutlined style={{ color: '#3b82f6' }} />}
                valueStyle={{ color: '#3b82f6' }}
                duration={900}
              >
                <div style={{ marginTop: 8, fontSize: 12, color: 'rgb(148, 163, 184)' }}>
                  <AnimatedNumber value={stats?.accounts?.total ?? 0} duration={700} /> total
                </div>
              </StatCard>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="dashboard-stat-card" style={CARD_STYLE} bodyStyle={{ padding: '20px' }}>
              <StatCard
                title="All Reservations"
                value={stats?.reservations?.active ?? 0}
                prefix={<CheckCircleOutlined style={{ color: '#16a34a' }} />}
                valueStyle={{ color: '#16a34a' }}
                duration={900}
              >
                <div style={{ marginTop: 8, fontSize: 12, color: 'rgb(148, 163, 184)' }}>
                  <AnimatedNumber value={stats?.reservations?.total ?? 0} duration={700} /> total
                </div>
              </StatCard>
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
                style={{ color: '#16a34a', padding: 0, fontWeight: 500 }}
              >
                View All <ArrowRightOutlined />
              </Button>
            }
            style={CARD_STYLE}
            bodyStyle={{ padding: '16px' }}
          >
            {recentActivity?.reservations?.length > 0 ? (
              <List
                dataSource={recentActivity.reservations}
                renderItem={(reservation) => (
                  <List.Item
                    style={{
                      borderColor: '#334155',
                      padding: '12px 8px',
                      margin: '0 -8px',
                      borderRadius: 8,
                      transition: 'background 0.15s ease'
                    }}
                    className="dashboard-activity-item"
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
                            {(reservation.commit?.message || 'No message').length > 60
                              ? `${reservation.commit.message.substring(0, 60)}...`
                              : (reservation.commit?.message || 'No message')}
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
                      padding: '12px 8px',
                      margin: '0 -8px',
                      borderRadius: 8,
                      transition: 'background 0.15s ease'
                    }}
                    className="dashboard-activity-item"
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
            style={CARD_STYLE}
            bodyStyle={{ padding: '20px' }}
          >
            <Space wrap size="middle">
              <Button
                type="primary"
                icon={<CodeOutlined />}
                size="large"
                onClick={() => navigate('/commits')}
                style={{
                  background: '#16a34a',
                  borderColor: '#16a34a',
                  height: 48,
                  paddingLeft: 24,
                  paddingRight: 24,
                  fontWeight: 600,
                  boxShadow: '0 2px 8px rgba(22, 163, 74, 0.35)'
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
