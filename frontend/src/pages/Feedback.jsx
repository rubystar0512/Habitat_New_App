import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Table,
  Tag,
  Space,
  Typography,
  message,
  Modal,
  Descriptions,
  Empty,
  Row,
  Col,
  Statistic,
  Divider
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  BugOutlined,
  RocketOutlined,
  ToolOutlined,
  BulbOutlined,
  ThunderboltOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import dayjs from 'dayjs';
import ReactMarkdown from 'react-markdown';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const Feedback = () => {
  const { user, isAdmin } = useAuth();
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitModalVisible, setSubmitModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [form] = Form.useForm();
  const [filters, setFilters] = useState({
    status: undefined,
    category: undefined,
    priority: undefined
  });
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });

  useEffect(() => {
    fetchFeedbacks();
    if (isAdmin()) {
      fetchStats();
    }
  }, [pagination.current, pagination.pageSize, filters.status, filters.category, filters.priority]);

  const fetchFeedbacks = async () => {
    setLoading(true);
    try {
      const params = {
        limit: pagination.pageSize,
        offset: (pagination.current - 1) * pagination.pageSize,
        ...(filters.status && { status: filters.status }),
        ...(filters.category && { category: filters.category }),
        ...(filters.priority && { priority: filters.priority })
      };
      const response = await api.get('/feedback', { params });
      setFeedbacks(response.data.feedbacks || []);
      setPagination(prev => ({ ...prev, total: response.data.total || 0 }));
    } catch (err) {
      console.error('Failed to fetch feedback:', err);
      message.error(err.response?.data?.error || 'Failed to fetch feedback');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/feedback/stats/overview');
      setStats(response.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const handleSubmit = async (values) => {
    setSubmitting(true);
    try {
      await api.post('/feedback', values);
      message.success('Feedback submitted successfully!');
      setSubmitModalVisible(false);
      form.resetFields();
      fetchFeedbacks();
      if (isAdmin()) {
        fetchStats();
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewDetails = async (id) => {
    try {
      const response = await api.get(`/feedback/${id}`);
      setSelectedFeedback(response.data.feedback);
      setDetailModalVisible(true);
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to fetch feedback details');
    }
  };

  const handleStatusUpdate = async (id, status, adminNotes) => {
    try {
      await api.patch(`/feedback/${id}`, { status, admin_notes: adminNotes });
      message.success('Feedback status updated successfully');
      fetchFeedbacks();
      fetchStats();
      if (selectedFeedback?.id === id) {
        const response = await api.get(`/feedback/${id}`);
        setSelectedFeedback(response.data.feedback);
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Failed to update feedback');
    }
  };

  const getCategoryIcon = (category) => {
    const icons = {
      bug: <BugOutlined />,
      feature: <RocketOutlined />,
      improvement: <ToolOutlined />,
      ui_ux: <BulbOutlined />,
      performance: <ThunderboltOutlined />,
      other: <QuestionCircleOutlined />
    };
    return icons[category] || <QuestionCircleOutlined />;
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'default',
      reviewing: 'processing',
      in_progress: 'processing',
      resolved: 'success',
      rejected: 'error',
      closed: 'default'
    };
    return colors[status] || 'default';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'default',
      medium: 'blue',
      high: 'orange',
      critical: 'red'
    };
    return colors[priority] || 'default';
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      sorter: (a, b) => a.id - b.id
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text, record) => (
        <Space>
          {getCategoryIcon(record.category)}
          <Text strong>{text}</Text>
        </Space>
      )
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (category) => (
        <Tag icon={getCategoryIcon(category)}>
          {category.replace('_', ' ').toUpperCase()}
        </Tag>
      )
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 100,
      render: (priority) => (
        <Tag color={getPriorityColor(priority)}>
          {priority.toUpperCase()}
        </Tag>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => (
        <Tag color={getStatusColor(status)}>
          {status.replace('_', ' ').toUpperCase()}
        </Tag>
      )
    },
    ...(isAdmin() ? [{
      title: 'Submitted By',
      dataIndex: ['user', 'username'],
      key: 'user',
      width: 120
    }] : []),
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm')
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetails(record.id)}
        >
          View
        </Button>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          border: '1px solid rgba(51, 65, 85, 0.5)',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
        }}
      >
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={2} style={{ color: '#f1f5f9', margin: 0 }}>
            Feedback
          </Title>
          <Space>
            {!isAdmin() && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setSubmitModalVisible(true)}
                style={{
                  background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                  border: 'none',
                  height: 40
                }}
              >
                Submit Feedback
              </Button>
            )}
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchFeedbacks}
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                color: '#f1f5f9',
                height: 40
              }}
            >
              Refresh
            </Button>
          </Space>
        </div>

        {isAdmin() && stats && (
          <>
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={6}>
                <Card style={{ background: '#1e293b', border: '1px solid #334155' }}>
                  <Statistic
                    title="Total Feedback"
                    value={stats.total}
                    valueStyle={{ color: '#f1f5f9' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card style={{ background: '#1e293b', border: '1px solid #334155' }}>
                  <Statistic
                    title="Pending"
                    value={stats.pending}
                    valueStyle={{ color: '#fbbf24' }}
                    prefix={<ClockCircleOutlined />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card style={{ background: '#1e293b', border: '1px solid #334155' }}>
                  <Statistic
                    title="In Progress"
                    value={stats.inProgress}
                    valueStyle={{ color: '#3b82f6' }}
                    prefix={<ClockCircleOutlined />}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card style={{ background: '#1e293b', border: '1px solid #334155' }}>
                  <Statistic
                    title="Resolved"
                    value={stats.resolved}
                    valueStyle={{ color: '#16a34a' }}
                    prefix={<CheckCircleOutlined />}
                  />
                </Card>
              </Col>
            </Row>
            <Divider style={{ borderColor: '#334155' }} />
          </>
        )}

        <Space style={{ marginBottom: 16 }}>
          <Select
            placeholder="Filter by Status"
            allowClear
            style={{ width: 150 }}
            value={filters.status}
            onChange={(value) => setFilters({ ...filters, status: value })}
          >
            <Option value="pending">Pending</Option>
            <Option value="reviewing">Reviewing</Option>
            <Option value="in_progress">In Progress</Option>
            <Option value="resolved">Resolved</Option>
            <Option value="rejected">Rejected</Option>
            <Option value="closed">Closed</Option>
          </Select>
          <Select
            placeholder="Filter by Category"
            allowClear
            style={{ width: 150 }}
            value={filters.category}
            onChange={(value) => setFilters({ ...filters, category: value })}
          >
            <Option value="bug">Bug</Option>
            <Option value="feature">Feature</Option>
            <Option value="improvement">Improvement</Option>
            <Option value="ui_ux">UI/UX</Option>
            <Option value="performance">Performance</Option>
            <Option value="other">Other</Option>
          </Select>
          <Select
            placeholder="Filter by Priority"
            allowClear
            style={{ width: 150 }}
            value={filters.priority}
            onChange={(value) => setFilters({ ...filters, priority: value })}
          >
            <Option value="low">Low</Option>
            <Option value="medium">Medium</Option>
            <Option value="high">High</Option>
            <Option value="critical">Critical</Option>
          </Select>
        </Space>

        <Table
          columns={columns}
          dataSource={feedbacks}
          loading={loading}
          rowKey="id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} feedback`,
            onChange: (page, pageSize) => {
              setPagination({ current: page, pageSize, total: pagination.total });
            }
          }}
          style={{
            background: '#1e293b',
            borderRadius: '8px'
          }}
        />
      </Card>

      {/* Submit Feedback Modal */}
      <Modal
        title="Submit Feedback"
        open={submitModalVisible}
        onCancel={() => {
          setSubmitModalVisible(false);
          form.resetFields();
        }}
        footer={null}
        width={700}
        style={{ top: 20 }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Please enter a title' }]}
          >
            <Input placeholder="Brief description of your feedback" />
          </Form.Item>

          <Form.Item
            name="category"
            label="Category"
            rules={[{ required: true, message: 'Please select a category' }]}
            initialValue="other"
          >
            <Select>
              <Option value="bug">🐛 Bug</Option>
              <Option value="feature">🚀 Feature Request</Option>
              <Option value="improvement">🔧 Improvement</Option>
              <Option value="ui_ux">💡 UI/UX</Option>
              <Option value="performance">⚡ Performance</Option>
              <Option value="other">❓ Other</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="priority"
            label="Priority"
            initialValue="medium"
          >
            <Select>
              <Option value="low">Low</Option>
              <Option value="medium">Medium</Option>
              <Option value="high">High</Option>
              <Option value="critical">Critical</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: 'Please provide a detailed description' }]}
          >
            <TextArea
              rows={8}
              placeholder="Please provide detailed information about your feedback. Include steps to reproduce for bugs, use cases for features, etc."
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
                style={{
                  background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                  border: 'none'
                }}
              >
                Submit Feedback
              </Button>
              <Button onClick={() => {
                setSubmitModalVisible(false);
                form.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Feedback Details Modal */}
      <Modal
        title="Feedback Details"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedFeedback(null);
        }}
        footer={null}
        width={800}
        style={{ top: 20 }}
      >
        {selectedFeedback && (
          <div>
            <Descriptions column={1} bordered>
              <Descriptions.Item label="Title">
                <Text strong>{selectedFeedback.title}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Category">
                <Tag icon={getCategoryIcon(selectedFeedback.category)}>
                  {selectedFeedback.category.replace('_', ' ').toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Priority">
                <Tag color={getPriorityColor(selectedFeedback.priority)}>
                  {selectedFeedback.priority.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={getStatusColor(selectedFeedback.status)}>
                  {selectedFeedback.status.replace('_', ' ').toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Submitted By">
                {selectedFeedback.user?.username || 'Unknown'}
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {dayjs(selectedFeedback.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              {selectedFeedback.resolvedAt && (
                <Descriptions.Item label="Resolved">
                  {dayjs(selectedFeedback.resolvedAt).format('YYYY-MM-DD HH:mm:ss')}
                  {selectedFeedback.resolver && ` by ${selectedFeedback.resolver.username}`}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Description">
                <div style={{ maxHeight: 300, overflow: 'auto', padding: 12, background: '#475569', borderRadius: 4 }}>
                  <ReactMarkdown>{selectedFeedback.description}</ReactMarkdown>
                </div>
              </Descriptions.Item>
              {selectedFeedback.adminNotes && (
                <Descriptions.Item label="Admin Notes">
                  <div style={{ maxHeight: 200, overflow: 'auto', padding: 12, background: '#475569', borderRadius: 4 }}>
                    <ReactMarkdown>{selectedFeedback.adminNotes}</ReactMarkdown>
                  </div>
                </Descriptions.Item>
              )}
            </Descriptions>

            {isAdmin() && (
              <div style={{ marginTop: 24 }}>
                <Title level={5}>Update Status</Title>
                <Space wrap>
                  <Button
                    onClick={() => handleStatusUpdate(selectedFeedback.id, 'reviewing', selectedFeedback.adminNotes)}
                    disabled={selectedFeedback.status === 'reviewing'}
                  >
                    Mark as Reviewing
                  </Button>
                  <Button
                    onClick={() => handleStatusUpdate(selectedFeedback.id, 'in_progress', selectedFeedback.adminNotes)}
                    disabled={selectedFeedback.status === 'in_progress'}
                  >
                    Mark as In Progress
                  </Button>
                  <Button
                    type="primary"
                    onClick={() => handleStatusUpdate(selectedFeedback.id, 'resolved', selectedFeedback.adminNotes)}
                    disabled={selectedFeedback.status === 'resolved' || selectedFeedback.status === 'closed'}
                    style={{
                      background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                      border: 'none'
                    }}
                  >
                    Mark as Resolved
                  </Button>
                  <Button
                    danger
                    onClick={() => handleStatusUpdate(selectedFeedback.id, 'rejected', selectedFeedback.adminNotes)}
                    disabled={selectedFeedback.status === 'rejected'}
                  >
                    Reject
                  </Button>
                  <Button
                    onClick={() => handleStatusUpdate(selectedFeedback.id, 'closed', selectedFeedback.adminNotes)}
                    disabled={selectedFeedback.status === 'closed'}
                  >
                    Close
                  </Button>
                </Space>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Feedback;
