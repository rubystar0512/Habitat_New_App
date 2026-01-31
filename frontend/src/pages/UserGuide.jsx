import React, { useState, useRef, useEffect } from 'react';
import { Card, Typography, Space, Alert, Collapse, List, Tag, Row, Col, Button, Affix, Divider, Badge } from 'antd';
import {
  DashboardOutlined,
  UserOutlined,
  DatabaseOutlined,
  CloudDownloadOutlined,
  SettingOutlined,
  TableOutlined,
  BookOutlined,
  CheckCircleOutlined,
  BarChartOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  InfoCircleOutlined,
  CheckCircleFilled,
  RocketOutlined,
  FileTextOutlined,
  ArrowRightOutlined,
  StarOutlined,
  BulbOutlined,
  SafetyOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph, Text } = Typography;

const UserGuide = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('getting-started');
  const sectionRefs = useRef({});

  const scrollToSection = (sectionId) => {
    const element = sectionRefs.current[sectionId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(sectionId);
    }
  };

  const navItems = [
    { id: 'getting-started', label: 'Getting Started', icon: <RocketOutlined /> },
    { id: 'dashboard', label: 'Dashboard', icon: <DashboardOutlined /> },
    { id: 'my-account', label: 'My Account', icon: <UserOutlined /> },
    { id: 'successful-tasks', label: 'Successful Tasks', icon: <TrophyOutlined /> },
    { id: 'statistics', label: 'Statistics', icon: <BarChartOutlined /> },
    { id: 'admin-features', label: 'Admin Features', icon: <SettingOutlined /> },
    { id: 'tips', label: 'Tips & Best Practices', icon: <BulbOutlined /> },
    { id: 'support', label: 'Need Help?', icon: <InfoCircleOutlined /> },
  ];

  const FeatureCard = ({ icon, title, description, features, badge, badgeColor }) => (
    <Card
      hoverable
      style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        border: '1px solid #334155',
        borderRadius: 12,
        height: '100%',
        transition: 'all 0.3s ease',
      }}
      bodyStyle={{ padding: 20 }}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Space>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            color: '#fff',
          }}>
            {icon}
          </div>
          <Space direction="vertical" size={0} style={{ flex: 1 }}>
            <Space>
              <Title level={4} style={{ color: '#f1f5f9', margin: 0 }}>
                {title}
              </Title>
              {badge && (
                <Tag color={badgeColor || 'green'} style={{ margin: 0 }}>
                  {badge}
                </Tag>
              )}
            </Space>
          </Space>
        </Space>
        <Paragraph style={{ color: '#cbd5e1', margin: 0, fontSize: 14 }}>
          {description}
        </Paragraph>
        {features && (
          <List
            size="small"
            dataSource={features}
            renderItem={(item) => (
              <List.Item style={{ border: 'none', padding: '6px 0' }}>
                <Space>
                  <CheckCircleFilled style={{ color: '#16a34a', fontSize: 12 }} />
                  <Text style={{ color: '#94a3b8', fontSize: 13 }}>{item}</Text>
                </Space>
              </List.Item>
            )}
          />
        )}
      </Space>
    </Card>
  );

  return (
    <div style={{ background: '#0f172a', minHeight: '100vh', padding: '24px' }}>
      <Row gutter={24}>
        {/* Sidebar Navigation */}
        <Col xs={0} lg={6}>
          <Affix offsetTop={24}>
            <Card
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 12,
                position: 'sticky',
                top: 24,
              }}
              bodyStyle={{ padding: 16 }}
            >
              <Title level={5} style={{ color: '#f1f5f9', marginBottom: 16 }}>
                <FileTextOutlined style={{ marginRight: 8 }} />
                Quick Navigation
              </Title>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                {navItems.map((item) => (
                  <Button
                    key={item.id}
                    type={activeSection === item.id ? 'primary' : 'text'}
                    icon={item.icon}
                    onClick={() => scrollToSection(item.id)}
                    block
                    style={{
                      textAlign: 'left',
                      height: 40,
                      color: activeSection === item.id ? '#fff' : '#cbd5e1',
                      background: activeSection === item.id
                        ? 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)'
                        : 'transparent',
                      border: 'none',
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
              </Space>
            </Card>
          </Affix>
        </Col>

        {/* Main Content */}
        <Col xs={24} lg={18}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Hero Header */}
            <Card
              style={{
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                border: '1px solid #334155',
                borderRadius: 16,
                overflow: 'hidden',
              }}
              bodyStyle={{ padding: 32 }}
            >
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Space>
                  <div style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 32,
                    color: '#fff',
                    boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)',
                  }}>
                    <BookOutlined />
                  </div>
                  <Space direction="vertical" size={4}>
                    <Title level={1} style={{ color: '#f1f5f9', margin: 0, fontSize: 32 }}>
                      User Guide
                    </Title>
                    <Text style={{ color: '#94a3b8', fontSize: 16 }}>
                      Everything you need to know about the Habitat Platform
                    </Text>
                  </Space>
                </Space>
                <Divider style={{ borderColor: '#334155', margin: '16px 0' }} />
                <Paragraph style={{ color: '#cbd5e1', fontSize: 15, margin: 0, lineHeight: 1.8 }}>
                  Welcome to the Habitat Platform! This comprehensive guide will help you understand all the features 
                  and get the most out of the platform. Whether you're a team member or administrator, you'll find 
                  everything you need to know right here.
                </Paragraph>
                <Alert
                  message="Quick Start"
                  description="New to the platform? Start with the Getting Started section below, then explore each feature as you need it."
                  type="info"
                  showIcon
                  icon={<RocketOutlined />}
                  style={{
                    background: 'linear-gradient(135deg, #1e3a5f 0%, #1e293b 100%)',
                    border: '1px solid #3b82f6',
                    borderRadius: 8,
                  }}
                />
              </Space>
            </Card>

            {/* Getting Started */}
            <div ref={(el) => (sectionRefs.current['getting-started'] = el)}>
              <Card
                title={
                  <Space>
                    <RocketOutlined style={{ color: '#16a34a', fontSize: 20 }} />
                    <Title level={3} style={{ color: '#f1f5f9', margin: 0 }}>
                      Getting Started
                    </Title>
                  </Space>
                }
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 12,
                }}
                bodyStyle={{ padding: 24 }}
              >
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <Paragraph style={{ color: '#cbd5e1', fontSize: 15, lineHeight: 1.8 }}>
                    The Habitat Platform is designed to help you manage commits, track successful tasks, and analyze 
                    your team's performance. Follow this guide to learn about each feature and how to use them effectively.
                  </Paragraph>
                  <Row gutter={[16, 16]}>
                    <Col xs={24} sm={12}>
                      <Card
                        style={{
                          background: 'linear-gradient(135deg, #1e3a5f 0%, #1e293b 100%)',
                          border: '1px solid #3b82f6',
                          borderRadius: 8,
                        }}
                        bodyStyle={{ padding: 16 }}
                      >
                        <Space direction="vertical" size="small">
                          <Text strong style={{ color: '#f1f5f9' }}>
                            <InfoCircleOutlined style={{ marginRight: 8, color: '#3b82f6' }} />
                            Navigation Tip
                          </Text>
                          <Text style={{ color: '#cbd5e1', fontSize: 13 }}>
                            Use the sidebar menu to navigate between different sections. The menu is collapsible for a cleaner view.
                          </Text>
                        </Space>
                      </Card>
                    </Col>
                    <Col xs={24} sm={12}>
                      <Card
                        style={{
                          background: 'linear-gradient(135deg, #3d2817 0%, #1e293b 100%)',
                          border: '1px solid #f59e0b',
                          borderRadius: 8,
                        }}
                        bodyStyle={{ padding: 16 }}
                      >
                        <Space direction="vertical" size="small">
                          <Text strong style={{ color: '#f1f5f9' }}>
                            <StarOutlined style={{ marginRight: 8, color: '#f59e0b' }} />
                            Pro Tip
                          </Text>
                          <Text style={{ color: '#cbd5e1', fontSize: 13 }}>
                            Bookmark this page for quick access. You can return here anytime from the Docs menu in the sidebar.
                          </Text>
                        </Space>
                      </Card>
                    </Col>
                  </Row>
                </Space>
              </Card>
            </div>

            {/* Dashboard */}
            <div ref={(el) => (sectionRefs.current['dashboard'] = el)}>
              <Card
                title={
                  <Space>
                    <DashboardOutlined style={{ color: '#16a34a', fontSize: 20 }} />
                    <Title level={3} style={{ color: '#f1f5f9', margin: 0 }}>
                      Dashboard
                    </Title>
                  </Space>
                }
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 12,
                }}
                bodyStyle={{ padding: 24 }}
              >
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <Paragraph style={{ color: '#cbd5e1', fontSize: 15, lineHeight: 1.8 }}>
                    The Dashboard provides an overview of your account activity and platform statistics. 
                    Here's what you'll find:
                  </Paragraph>
                  <Row gutter={[16, 16]}>
                    {[
                      { title: 'Account Statistics', desc: 'View your total commits, reservations, and successful tasks', icon: <UserOutlined /> },
                      { title: 'Recent Activity', desc: 'See your latest commits and reservations', icon: <ClockCircleOutlined /> },
                      { title: 'Quick Actions', desc: 'Access frequently used features quickly', icon: <RocketOutlined /> },
                      { title: 'Performance Metrics', desc: 'Track your progress and earnings over time', icon: <BarChartOutlined /> },
                    ].map((item, idx) => (
                      <Col xs={24} sm={12} key={idx}>
                        <FeatureCard
                          icon={item.icon}
                          title={item.title}
                          description={item.desc}
                        />
                      </Col>
                    ))}
                  </Row>
                </Space>
              </Card>
            </div>

            {/* My Account */}
            <div ref={(el) => (sectionRefs.current['my-account'] = el)}>
              <Card
                title={
                  <Space>
                    <UserOutlined style={{ color: '#16a34a', fontSize: 20 }} />
                    <Title level={3} style={{ color: '#f1f5f9', margin: 0 }}>
                      My Account
                    </Title>
                  </Space>
                }
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 12,
                }}
                bodyStyle={{ padding: 24 }}
              >
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <Paragraph style={{ color: '#cbd5e1', fontSize: 15, lineHeight: 1.8 }}>
                    Manage your account settings, commits, reservations, and more. All your personal account features are organized here.
                  </Paragraph>
                  <Collapse
                    ghost
                    expandIconPosition="end"
                    items={[
                      {
                        key: 'habitat-accounts',
                        label: (
                          <Space>
                            <SettingOutlined style={{ color: '#16a34a' }} />
                            <Text strong style={{ color: '#f1f5f9', fontSize: 15 }}>
                              Habitat Accounts
                            </Text>
                          </Space>
                        ),
                        children: (
                          <Space direction="vertical" size="middle" style={{ width: '100%', paddingLeft: 24 }}>
                            <Paragraph style={{ color: '#cbd5e1', margin: 0 }}>
                              Manage your Habitat API accounts. You can add multiple accounts to increase your reservation capacity.
                            </Paragraph>
                            <List
                              size="small"
                              dataSource={[
                                'Add new Habitat accounts with API tokens',
                                'View account health and status',
                                'Monitor account usage and limits',
                                'Set account preferences and settings',
                              ]}
                              renderItem={(item) => (
                                <List.Item style={{ border: 'none', padding: '6px 0' }}>
                                  <Space>
                                    <CheckCircleFilled style={{ color: '#16a34a', fontSize: 12 }} />
                                    <Text style={{ color: '#94a3b8', fontSize: 13 }}>{item}</Text>
                                  </Space>
                                </List.Item>
                              )}
                            />
                          </Space>
                        ),
                      },
                      {
                        key: 'commits',
                        label: (
                          <Space>
                            <TableOutlined style={{ color: '#16a34a' }} />
                            <Text strong style={{ color: '#f1f5f9', fontSize: 15 }}>
                              Commits
                            </Text>
                          </Space>
                        ),
                        children: (
                          <Space direction="vertical" size="middle" style={{ width: '100%', paddingLeft: 24 }}>
                            <Paragraph style={{ color: '#cbd5e1', margin: 0 }}>
                              Browse and search through all available commits. Filter by repository, date, status, and more.
                            </Paragraph>
                            <List
                              size="small"
                              dataSource={[
                                'Search commits by hash, message, or author',
                                'Filter by repository, date range, and status',
                                'View commit details including scores and metadata',
                                'Check commit availability for reservations',
                                'Sort and organize commits for easy navigation',
                              ]}
                              renderItem={(item) => (
                                <List.Item style={{ border: 'none', padding: '6px 0' }}>
                                  <Space>
                                    <CheckCircleFilled style={{ color: '#16a34a', fontSize: 12 }} />
                                    <Text style={{ color: '#94a3b8', fontSize: 13 }}>{item}</Text>
                                  </Space>
                                </List.Item>
                              )}
                            />
                            <Alert
                              message="Admin Only"
                              description="Admins can see additional fields like Habitat Score, Difficulty, and Suitability scores."
                              type="warning"
                              showIcon
                              style={{
                                background: '#3d2817',
                                border: '1px solid #f59e0b',
                                marginTop: 12,
                                borderRadius: 8,
                              }}
                            />
                          </Space>
                        ),
                      },
                      {
                        key: 'memo',
                        label: (
                          <Space>
                            <BookOutlined style={{ color: '#16a34a' }} />
                            <Text strong style={{ color: '#f1f5f9', fontSize: 15 }}>
                              Memo
                            </Text>
                          </Space>
                        ),
                        children: (
                          <Space direction="vertical" size="middle" style={{ width: '100%', paddingLeft: 24 }}>
                            <Paragraph style={{ color: '#cbd5e1', margin: 0 }}>
                              Keep notes and reminders about commits, tasks, or important information.
                            </Paragraph>
                            <List
                              size="small"
                              dataSource={[
                                'Create and manage memos',
                                'Link memos to specific commits',
                                'Organize memos with tags',
                                'Search and filter your memos',
                              ]}
                              renderItem={(item) => (
                                <List.Item style={{ border: 'none', padding: '6px 0' }}>
                                  <Space>
                                    <CheckCircleFilled style={{ color: '#16a34a', fontSize: 12 }} />
                                    <Text style={{ color: '#94a3b8', fontSize: 13 }}>{item}</Text>
                                  </Space>
                                </List.Item>
                              )}
                            />
                          </Space>
                        ),
                      },
                      {
                        key: 'reservations',
                        label: (
                          <Space>
                            <CheckCircleOutlined style={{ color: '#16a34a' }} />
                            <Text strong style={{ color: '#f1f5f9', fontSize: 15 }}>
                              Reservations
                            </Text>
                          </Space>
                        ),
                        children: (
                          <Space direction="vertical" size="middle" style={{ width: '100%', paddingLeft: 24 }}>
                            <Paragraph style={{ color: '#cbd5e1', margin: 0 }}>
                              View and manage your commit reservations. Track which commits you've reserved and their current status.
                            </Paragraph>
                            <List
                              size="small"
                              dataSource={[
                                'View all your active and completed reservations',
                                'Check reservation status and expiration',
                                'Monitor reservation history',
                                'Filter reservations by status, date, or repository',
                              ]}
                              renderItem={(item) => (
                                <List.Item style={{ border: 'none', padding: '6px 0' }}>
                                  <Space>
                                    <CheckCircleFilled style={{ color: '#16a34a', fontSize: 12 }} />
                                    <Text style={{ color: '#94a3b8', fontSize: 13 }}>{item}</Text>
                                  </Space>
                                </List.Item>
                              )}
                            />
                          </Space>
                        ),
                      },
                      {
                        key: 'auto-reservation',
                        label: (
                          <Space>
                            <ThunderboltOutlined style={{ color: '#16a34a' }} />
                            <Text strong style={{ color: '#f1f5f9', fontSize: 15 }}>
                              Auto Reservation
                            </Text>
                            <Tag color="blue" style={{ marginLeft: 8 }}>Automated</Tag>
                          </Space>
                        ),
                        children: (
                          <Space direction="vertical" size="middle" style={{ width: '100%', paddingLeft: 24 }}>
                            <Paragraph style={{ color: '#cbd5e1', margin: 0 }}>
                              Automatically reserve commits based on your configured criteria. Set up rules and let the system handle reservations for you.
                            </Paragraph>
                            <List
                              size="small"
                              dataSource={[
                                'Configure automatic reservation rules',
                                'Set filters for commits to auto-reserve',
                                'Schedule reservation times',
                                'Monitor auto-reservation activity',
                              ]}
                              renderItem={(item) => (
                                <List.Item style={{ border: 'none', padding: '6px 0' }}>
                                  <Space>
                                    <CheckCircleFilled style={{ color: '#16a34a', fontSize: 12 }} />
                                    <Text style={{ color: '#94a3b8', fontSize: 13 }}>{item}</Text>
                                  </Space>
                                </List.Item>
                              )}
                            />
                            <Alert
                              message="Automation"
                              description="Auto Reservation runs in the background and will automatically reserve commits that match your criteria."
                              type="info"
                              showIcon
                              style={{
                                background: '#1e3a5f',
                                border: '1px solid #3b82f6',
                                marginTop: 12,
                                borderRadius: 8,
                              }}
                            />
                          </Space>
                        ),
                      },
                    ]}
                    style={{ background: 'transparent' }}
                  />
                </Space>
              </Card>
            </div>

            {/* Successful Tasks */}
            <div ref={(el) => (sectionRefs.current['successful-tasks'] = el)}>
              <Card
                title={
                  <Space>
                    <TrophyOutlined style={{ color: '#16a34a', fontSize: 20 }} />
                    <Title level={3} style={{ color: '#f1f5f9', margin: 0 }}>
                      Successful Tasks
                    </Title>
                  </Space>
                }
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 12,
                }}
                bodyStyle={{ padding: 24 }}
              >
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <Paragraph style={{ color: '#cbd5e1', fontSize: 15, lineHeight: 1.8 }}>
                    Submit and manage your successful tasks. This is where you document commits that you've successfully completed.
                  </Paragraph>
                  <Row gutter={[16, 16]}>
                    {[
                      {
                        title: 'Submit New Task',
                        desc: 'Create a new successful task entry with commit details, task description, and patches',
                        steps: [
                          'Enter Git Base Commit and Merge Commit hashes',
                          'Provide task name and description (supports Markdown)',
                          'Add golden patch and test patch code',
                          'Optionally add hints or notes',
                          'Submit the task (automatically approved)',
                        ],
                        icon: <FileTextOutlined />,
                        color: 'green',
                      },
                      {
                        title: 'Edit Tasks',
                        desc: 'Update your submitted tasks at any time',
                        steps: [
                          'Click Edit on any task you created',
                          'Modify the fields as needed',
                          'Save your changes',
                        ],
                        icon: <SettingOutlined />,
                        color: 'blue',
                      },
                      {
                        title: 'Delete Tasks',
                        desc: 'Remove tasks you no longer need',
                        steps: [
                          'Team members can delete their own tasks',
                          'Admins can delete any task',
                          'Use the Delete button in the task list',
                        ],
                        icon: <CheckCircleOutlined />,
                        color: 'red',
                      },
                    ].map((item, idx) => (
                      <Col xs={24} md={8} key={idx}>
                        <Card
                          hoverable
                          style={{
                            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                            border: '1px solid #334155',
                            borderRadius: 12,
                            height: '100%',
                          }}
                          bodyStyle={{ padding: 20 }}
                        >
                          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                            <Space>
                              <div style={{
                                width: 40,
                                height: 40,
                                borderRadius: 10,
                                background: `linear-gradient(135deg, var(--ant-${item.color}-6) 0%, var(--ant-${item.color}-7) 100%)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 20,
                                color: '#fff',
                              }}>
                                {item.icon}
                              </div>
                              <Title level={5} style={{ color: '#f1f5f9', margin: 0 }}>
                                {item.title}
                              </Title>
                            </Space>
                            <Paragraph style={{ color: '#cbd5e1', margin: 0, fontSize: 13 }}>
                              {item.desc}
                            </Paragraph>
                            <List
                              size="small"
                              dataSource={item.steps}
                              renderItem={(step, stepIdx) => (
                                <List.Item style={{ border: 'none', padding: '4px 0' }}>
                                  <Space>
                                    <Badge
                                      count={stepIdx + 1}
                                      style={{ backgroundColor: `var(--ant-${item.color}-6)` }}
                                    />
                                    <Text style={{ color: '#94a3b8', fontSize: 12 }}>{step}</Text>
                                  </Space>
                                </List.Item>
                              )}
                            />
                          </Space>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                  <Alert
                    message="Markdown Support"
                    description="Task descriptions support Markdown formatting. Use it to format your text, add code blocks, lists, and more."
                    type="info"
                    showIcon
                    icon={<FileTextOutlined />}
                    style={{
                      background: '#1e3a5f',
                      border: '1px solid #3b82f6',
                      borderRadius: 8,
                    }}
                  />
                </Space>
              </Card>
            </div>

            {/* Statistics */}
            <div ref={(el) => (sectionRefs.current['statistics'] = el)}>
              <Card
                title={
                  <Space>
                    <BarChartOutlined style={{ color: '#16a34a', fontSize: 20 }} />
                    <Title level={3} style={{ color: '#f1f5f9', margin: 0 }}>
                      Statistics
                    </Title>
                  </Space>
                }
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 12,
                }}
                bodyStyle={{ padding: 24 }}
              >
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <Paragraph style={{ color: '#cbd5e1', fontSize: 15, lineHeight: 1.8 }}>
                    Analyze your performance and team statistics with interactive charts and visualizations.
                  </Paragraph>
                  <Row gutter={[16, 16]}>
                    {[
                      { title: 'Commits by Repository', desc: 'See commit distribution across different repositories', badge: 'All Users' },
                      { title: 'Commit Score Distribution', desc: 'View how commits are distributed across difficulty levels', badge: 'All Users' },
                      { title: 'Average Scores by Repository', desc: 'Compare habitat, suitability, and difficulty scores across repos', badge: 'All Users' },
                      { title: 'Earnings Over Time', desc: 'Track your earnings progression', badge: 'Team Only' },
                      { title: 'Earnings by Repository', desc: 'See which repositories generate the most earnings', badge: 'Team Only' },
                      { title: 'Team Member Performance', desc: 'Compare performance across team members', badge: 'Admin Only' },
                      { title: 'Team Member Earnings', desc: 'View earnings breakdown by team member', badge: 'Admin Only' },
                    ].map((item, idx) => (
                      <Col xs={24} sm={12} lg={8} key={idx}>
                        <FeatureCard
                          icon={<BarChartOutlined />}
                          title={item.title}
                          description={item.desc}
                          badge={item.badge}
                          badgeColor={item.badge === 'Admin Only' ? 'red' : item.badge === 'Team Only' ? 'blue' : 'green'}
                        />
                      </Col>
                    ))}
                  </Row>
                  <Alert
                    message="Time Range Filter"
                    description="Use the time range filter at the top of the Statistics page to analyze data for specific periods."
                    type="info"
                    showIcon
                    icon={<BarChartOutlined />}
                    style={{
                      background: '#1e3a5f',
                      border: '1px solid #3b82f6',
                      borderRadius: 8,
                    }}
                  />
                </Space>
              </Card>
            </div>

            {/* Admin Features */}
            <div ref={(el) => (sectionRefs.current['admin-features'] = el)}>
              <Card
                title={
                  <Space>
                    <SettingOutlined style={{ color: '#16a34a', fontSize: 20 }} />
                    <Title level={3} style={{ color: '#f1f5f9', margin: 0 }}>
                      Admin Features
                    </Title>
                    <Tag color="red" icon={<SafetyOutlined />}>Admin Only</Tag>
                  </Space>
                }
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 12,
                }}
                bodyStyle={{ padding: 24 }}
              >
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <Alert
                    message="Administrator Access Required"
                    description="The following features are only available to administrators. Contact your system administrator if you need access to these features."
                    type="warning"
                    showIcon
                    icon={<SafetyOutlined />}
                    style={{
                      background: '#3d2817',
                      border: '1px solid #f59e0b',
                      borderRadius: 8,
                    }}
                  />
                  <Row gutter={[16, 16]}>
                    {[
                      {
                        title: 'User Management',
                        desc: 'Manage user accounts, roles, and permissions. Create new users, update existing ones, and control access to platform features.',
                        icon: <UserOutlined />,
                      },
                      {
                        title: 'Repo Management',
                        desc: 'Add and manage Git repositories. Configure repository settings, map to Habitat repositories, and control which repos are available to users.',
                        icon: <DatabaseOutlined />,
                      },
                      {
                        title: 'Fetch Commits',
                        desc: 'Fetch new commits from connected repositories. This updates the commit database with the latest commits and their metadata.',
                        icon: <CloudDownloadOutlined />,
                      },
                    ].map((item, idx) => (
                      <Col xs={24} md={8} key={idx}>
                        <FeatureCard
                          icon={item.icon}
                          title={item.title}
                          description={item.desc}
                        />
                      </Col>
                    ))}
                  </Row>
                </Space>
              </Card>
            </div>

            {/* Tips & Best Practices */}
            <div ref={(el) => (sectionRefs.current['tips'] = el)}>
              <Card
                title={
                  <Space>
                    <BulbOutlined style={{ color: '#16a34a', fontSize: 20 }} />
                    <Title level={3} style={{ color: '#f1f5f9', margin: 0 }}>
                      Tips & Best Practices
                    </Title>
                  </Space>
                }
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 12,
                }}
                bodyStyle={{ padding: 24 }}
              >
                <Row gutter={[16, 16]}>
                  {[
                    'Use the search and filter features to quickly find commits you need',
                    'Keep your Habitat accounts healthy by monitoring their status regularly',
                    'Submit successful tasks promptly to maintain accurate statistics',
                    'Use memos to track important information about commits',
                    'Set up auto-reservation rules to save time on manual reservations',
                    'Check the Statistics page regularly to track your progress',
                    'Use Markdown in task descriptions for better formatting',
                    'Keep your account information up to date',
                  ].map((tip, idx) => (
                    <Col xs={24} sm={12} key={idx}>
                      <Card
                        hoverable
                        style={{
                          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                          border: '1px solid #334155',
                          borderRadius: 8,
                          height: '100%',
                        }}
                        bodyStyle={{ padding: 16 }}
                      >
                        <Space>
                          <CheckCircleFilled style={{ color: '#16a34a', fontSize: 16 }} />
                          <Text style={{ color: '#cbd5e1', fontSize: 14 }}>{tip}</Text>
                        </Space>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </Card>
            </div>

            {/* Support */}
            <div ref={(el) => (sectionRefs.current['support'] = el)}>
              <Card
                title={
                  <Space>
                    <InfoCircleOutlined style={{ color: '#16a34a', fontSize: 20 }} />
                    <Title level={3} style={{ color: '#f1f5f9', margin: 0 }}>
                      Need Help?
                    </Title>
                  </Space>
                }
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: 12,
                }}
                bodyStyle={{ padding: 24 }}
              >
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <Paragraph style={{ color: '#cbd5e1', fontSize: 15, lineHeight: 1.8 }}>
                    If you need additional help or have questions about the platform:
                  </Paragraph>
                  <Row gutter={[16, 16]}>
                    {[
                      {
                        title: 'Refer to This Guide',
                        desc: 'Come back to this guide anytime from the Docs menu in the sidebar',
                        icon: <BookOutlined />,
                        action: () => scrollToSection('getting-started'),
                      },
                      {
                        title: 'Contact Administrator',
                        desc: 'Reach out to your team administrator for account-related issues',
                        icon: <UserOutlined />,
                      },
                      {
                        title: 'Check Dashboard',
                        desc: 'View platform status and announcements on the Dashboard',
                        icon: <DashboardOutlined />,
                        action: () => navigate('/dashboard'),
                      },
                    ].map((item, idx) => (
                      <Col xs={24} md={8} key={idx}>
                        <Card
                          hoverable
                          onClick={item.action}
                          style={{
                            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                            border: '1px solid #334155',
                            borderRadius: 12,
                            height: '100%',
                            cursor: item.action ? 'pointer' : 'default',
                          }}
                          bodyStyle={{ padding: 20 }}
                        >
                          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                            <div style={{
                              width: 48,
                              height: 48,
                              borderRadius: 12,
                              background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 24,
                              color: '#fff',
                            }}>
                              {item.icon}
                            </div>
                            <Title level={5} style={{ color: '#f1f5f9', margin: 0 }}>
                              {item.title}
                            </Title>
                            <Paragraph style={{ color: '#cbd5e1', margin: 0, fontSize: 13 }}>
                              {item.desc}
                            </Paragraph>
                            {item.action && (
                              <Button
                                type="link"
                                icon={<ArrowRightOutlined />}
                                style={{ color: '#16a34a', padding: 0 }}
                              >
                                Go there
                              </Button>
                            )}
                          </Space>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                </Space>
              </Card>
            </div>
          </Space>
        </Col>
      </Row>
    </div>
  );
};

export default UserGuide;
