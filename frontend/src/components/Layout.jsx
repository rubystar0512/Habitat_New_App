import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout as AntLayout, Menu, Avatar, Button, Space, Typography } from 'antd';
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
  LogoutOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  FileTextOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { Header, Sider, Content } = AntLayout;
const { Text } = Typography;

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    ...(isAdmin() ? [
      {
        key: 'admin',
        icon: <SettingOutlined />,
        label: 'Admin',
        children: [
          { key: '/admin/users', icon: <UserOutlined />, label: 'User Management' },
          { key: '/admin/repos', icon: <DatabaseOutlined />, label: 'Repo Management' },
          { key: '/admin/commits/fetch', icon: <CloudDownloadOutlined />, label: 'Fetch Commits' },
        ],
      },
    ] : []),
    {
      key: 'user',
      icon: <UserOutlined />,
      label: 'My Account',
      children: [
        { key: '/accounts', icon: <SettingOutlined />, label: 'Habitat Accounts' },
        { key: '/commits', icon: <TableOutlined />, label: 'Commits' },
        { key: '/memo', icon: <BookOutlined />, label: 'Memo' },
        { key: '/reservations', icon: <CheckCircleOutlined />, label: 'Reservations' },
        { key: '/reservation-cron', icon: <ThunderboltOutlined />, label: 'Auto Reservation' },
      ],
    },
    {
      key: '/successful-tasks',
      icon: <TrophyOutlined />,
      label: 'Successful Tasks',
    },
    {
      key: '/statistics',
      icon: <BarChartOutlined />,
      label: 'Statistics',
    },
    {
      key: '/feedback',
      icon: <MessageOutlined />,
      label: 'Feedback',
    },
    {
      key: '/docs',
      icon: <FileTextOutlined />,
      label: 'Docs',
    },
  ];

  const getPageTitle = () => {
    const findInMenu = (items, path) => {
      for (const item of items) {
        if (item.key === path) return item.label;
        if (item.children) {
          const found = item.children.find(child => child.key === path);
          if (found) return found.label;
        }
      }
      return null;
    };

    return findInMenu(menuItems, location.pathname) || 'Habitat';
  };

  return (
    <AntLayout style={{ minHeight: '100vh', background: '#0f172a' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        width={240}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          background: '#0f172a',
          borderRight: '1px solid rgba(30, 41, 59, 0.5)',
          boxShadow: '2px 0 8px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div style={{ 
          height: 64, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? 0 : '0 24px',
          color: '#16a34a',
          fontSize: collapsed ? 20 : 18,
          fontWeight: 600,
          borderBottom: '1px solid #334155',
          marginBottom: 8
        }}>
          {collapsed ? (
            <img 
              src="/assets/icon_64x64.png" 
              alt="Habitat" 
              style={{ width: 32, height: 32, objectFit: 'contain' }}
            />
          ) : (
            <Space>
              <img 
                src="/assets/icon_64x64.png" 
                alt="Habitat" 
                style={{ width: 30, height: 30, objectFit: 'contain' }}
              />
              <span style={{ fontSize: 21, fontWeight: 600 }}>Habitat</span>
            </Space>
          )}
        </div>
        <Menu
          theme="dark"
          selectedKeys={[location.pathname]}
          mode="inline"
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <AntLayout style={{ marginLeft: collapsed ? 80 : 240, transition: 'all 0.2s' }}>
        <Header style={{ 
          background: '#1e293b',
          padding: '0 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(51, 65, 85, 0.5)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
        }}>
          <div style={{ fontSize: 16, fontWeight: 500, color: 'rgb(241, 245, 249)' }}>
            {getPageTitle()}
          </div>
          <Space size={16} align="center">
            <Space size={12} align="center">
              <Avatar 
                size={36}
                style={{ 
                  background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                  border: '2px solid rgba(255, 255, 255, 0.1)'
                }} 
                icon={<UserOutlined />} 
              />
              <Space direction="vertical" size={0} style={{ lineHeight: 1.4 }}>
                <Text strong style={{ color: 'rgb(241, 245, 249)', fontSize: 14, display: 'block' }}>
                  {user?.username}
                </Text>
              </Space>
            </Space>
            <Button
              type="text"
              danger
              icon={<LogoutOutlined />}
              onClick={() => {
                logout();
                navigate('/login');
              }}
              style={{
                color: '#ff4d4f',
                background: '#1e293b',
                border: '1px solid #334155',
                height: 36,
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px',
                gap: 6
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#2a1215';
                e.currentTarget.style.borderColor = '#ff4d4f';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#1e293b';
                e.currentTarget.style.borderColor = '#334155';
              }}
            >
            </Button>
          </Space>
        </Header>
        <Content style={{ 
          margin: '24px', 
          background: 'transparent',
          minHeight: 'calc(100vh - 112px)'
        }}>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;
