import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values) => {
    setLoading(true);
    const result = await login(values.username, values.password);
    setLoading(false);

    if (result.success) {
      message.success('Login successful!');
      navigate('/dashboard');
    } else {
      message.error(result.error || 'Login failed');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0f172a',
      padding: '20px'
    }}>
      <Card
        style={{
          width: '100%',
          maxWidth: 400,
          background: '#1e293b',
          border: '1px solid #334155'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img 
            src="/assets/icon_128x128.png" 
            alt="Habitat" 
            style={{ 
              width: 50, 
              height: 50, 
              objectFit: 'contain',
              marginBottom: 16 
            }} 
          />
          <Title level={2} style={{ color: 'rgb(241, 245, 249)', margin: 0 }}>
            Habitat
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            Sign in to your account
          </Text>
        </div>

        <Form
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: 'Please input your username!' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Please input your password!' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Password"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              style={{ height: 40 }}
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text type="secondary" style={{ fontSize: 14 }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: '#16a34a' }}>
              Sign up
            </Link>
          </Text>
        </div>
      </Card>
    </div>
  );
};

export default Login;
