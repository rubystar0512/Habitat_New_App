import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Select, Typography, Spin, Space, Button, Radio, Skeleton } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

const Statistics = () => {
  const { isAdmin } = useAuth();
  const [timeRange, setTimeRange] = useState(30);
  const [viewMode, setViewMode] = useState('daily');

  // Data states
  const [repoCommitsData, setRepoCommitsData] = useState([]);
  const [teamStatsData, setTeamStatsData] = useState([]);
  const [teamAccounts, setTeamAccounts] = useState([]);
  const [repoWinRates, setRepoWinRates] = useState([]);

  // Individual loading states
  const [loadingRepoCommits, setLoadingRepoCommits] = useState(true);
  const [loadingRepoWinRates, setLoadingRepoWinRates] = useState(true);
  const [loadingTeamStats, setLoadingTeamStats] = useState(true);
  const [loadingTeamAccounts, setLoadingTeamAccounts] = useState(true);

  useEffect(() => {
    fetchAllData();
  }, [timeRange]);

  const fetchAllData = async () => {
    // Reset all loading states
    setLoadingRepoCommits(true);
    setLoadingRepoWinRates(true);
    setLoadingTeamStats(true);
    setLoadingTeamAccounts(true);

    // Fetch each API call individually
    // Repo Commits
    api.get('/stats/repo-commits')
      .then(res => {
        setRepoCommitsData(res?.data?.data ?? []);
      })
      .catch(error => {
        console.error('Failed to fetch repo commits:', error);
      })
      .finally(() => {
        setLoadingRepoCommits(false);
      });

    // Repo Win Rates
    api.get('/stats/repo-win-rates')
      .then(res => {
        setRepoWinRates(res?.data?.repoWinRates ?? []);
      })
      .catch(error => {
        console.error('Failed to fetch repo win rates:', error);
      })
      .finally(() => {
        setLoadingRepoWinRates(false);
      });

    // Team Stats
    api.get('/stats/team-stats')
      .then(res => {
        setTeamStatsData(res?.data?.data ?? []);
      })
      .catch(error => {
        console.error('Failed to fetch team stats:', error);
      })
      .finally(() => {
        setLoadingTeamStats(false);
      });

    // Team Accounts
    api.get('/stats/team-accounts')
      .then(res => {
        setTeamAccounts(res?.data?.data ?? []);
      })
      .catch(error => {
        console.error('Failed to fetch team accounts:', error);
      })
      .finally(() => {
        setLoadingTeamAccounts(false);
      });
  };

  // Repo Commits Chart
  const repoCommitsOption = {
    title: {
      text: 'Commits by Repository',
      left: 'center',
      textStyle: { color: 'rgb(241, 245, 249)' }
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} commits ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      top: 'middle',
      textStyle: { color: 'rgb(148, 163, 184)' },
      type: 'scroll'
    },
    series: [
      {
        name: 'Commits',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#0f172a',
          borderWidth: 2
        },
        label: {
          show: true,
          formatter: '{b}: {c}',
          color: 'rgb(241, 245, 249)'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold'
          }
        },
        data: repoCommitsData.slice(0, 20).map(item => ({
          value: item.value,
          name: item.name
        }))
      }
    ],
    backgroundColor: 'transparent'
  };


  // Team Stats Chart
  const teamStatsOption = {
    title: {
      text: 'Team Member Performance',
      left: 'center',
      textStyle: { color: 'rgb(241, 245, 249)' }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    legend: {
      data: ['Total Reservations', 'Active Reservations', 'Successful Tasks'],
      top: 30,
      textStyle: { color: 'rgb(148, 163, 184)' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: teamStatsData.map(t => t.username),
      axisLabel: {
        color: 'rgb(148, 163, 184)',
        rotate: 45
      }
    },
    yAxis: {
      type: 'value',
      name: 'Count',
      nameTextStyle: { color: 'rgb(148, 163, 184)' },
      axisLabel: { color: 'rgb(148, 163, 184)' },
      splitLine: {
        lineStyle: { color: '#334155' }
      }
    },
    series: [
      {
        name: 'Total Reservations',
        type: 'bar',
        data: teamStatsData.map(t => t.totalReservations),
        itemStyle: { color: '#16a34a' }
      },
      {
        name: 'Active Reservations',
        type: 'bar',
        data: teamStatsData.map(t => t.activeReservations),
        itemStyle: { color: '#3b82f6' }
      },
      {
        name: 'Successful Tasks',
        type: 'bar',
        data: teamStatsData.map(t => t.successfulTasks),
        itemStyle: { color: '#f59e0b' }
      }
    ],
    backgroundColor: 'transparent'
  };

  // Focus rate per repo: which repo to focus on first (from paid_out commits' scores + pattern)
  const repoWinRatesSorted = [...(repoWinRates || [])]
    .sort((a, b) => (b.focusRate ?? 0) - (a.focusRate ?? 0))
    .slice(0, 20);
  const repoWinRatesOption = {
    title: {
      text: 'Focus Rate per Repository',
      left: 'center',
      textStyle: { color: 'rgb(241, 245, 249)' },
      subtextStyle: { color: 'rgb(148, 163, 184)', fontSize: 12 }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const idx = params?.[0]?.dataIndex;
        const item = repoWinRatesSorted[idx];
        if (!item) return '';
        const source = (item.paidOutCount ?? 0) > 0 ? 'from paid_out commits' : 'from all commits (no wins yet)';
        return `${item.fullName || item.repoName || ''}<br/>Focus rate: ${item.focusRate ?? 0} (${source})<br/>Win rate: ${item.winRate ?? 0}% · Paid out: ${item.paidOutCount ?? 0} / ${item.totalCommits ?? 0}`;
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: repoWinRatesSorted.map(r => r.fullName || r.repoName || ''),
      axisLabel: {
        color: 'rgb(148, 163, 184)',
        fontSize: 11,
        rotate: 45
      }
    },
    yAxis: {
      type: 'value',
      name: 'Focus rate (0–100)',
      min: 0,
      max: 100,
      nameTextStyle: { color: 'rgb(148, 163, 184)' },
      axisLabel: { color: 'rgb(148, 163, 184)' },
      splitLine: { lineStyle: { color: '#334155' } }
    },
    series: [
      {
        name: 'Focus rate',
        type: 'bar',
        data: repoWinRatesSorted.map(r => ({
          value: r.focusRate ?? 0,
          itemStyle: {
            color: (r.focusRate ?? 0) >= 50 ? '#22c55e' : (r.focusRate ?? 0) >= 20 ? '#f59e0b' : '#64748b'
          }
        })),
        barMaxWidth: 40
      }
    ],
    backgroundColor: 'transparent'
  };

  // Team Accounts Chart
  const teamAccountsOption = teamAccounts.length > 0 ? {
    title: {
      text: 'Habitat Account Count per Team Member',
      left: 'center',
      textStyle: { color: 'rgb(241, 245, 249)' }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        let result = `${params[0].axisValue}<br/>`;
        params.forEach(param => {
          result += `${param.seriesName}: ${param.value}<br/>`;
        });
        return result;
      }
    },
    legend: {
      data: ['Total Accounts', 'Active Accounts', 'Inactive Accounts'],
      top: 30,
      textStyle: { color: 'rgb(148, 163, 184)' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: teamAccounts.map(t => t.username),
      axisLabel: {
        color: 'rgb(148, 163, 184)',
        rotate: 45
      }
    },
    yAxis: {
      type: 'value',
      name: 'Account Count',
      nameTextStyle: { color: 'rgb(148, 163, 184)' },
      axisLabel: { color: 'rgb(148, 163, 184)' },
      splitLine: {
        lineStyle: { color: '#334155' }
      }
    },
    series: [
      {
        name: 'Total Accounts',
        type: 'bar',
        data: teamAccounts.map(t => t.totalAccounts),
        itemStyle: { color: '#16a34a' }
      },
      {
        name: 'Active Accounts',
        type: 'bar',
        data: teamAccounts.map(t => t.activeAccounts),
        itemStyle: { color: '#3b82f6' }
      },
      {
        name: 'Inactive Accounts',
        type: 'bar',
        data: teamAccounts.map(t => t.inactiveAccounts),
        itemStyle: { color: '#64748b' }
      }
    ],
    backgroundColor: 'transparent'
  } : null;

  // Team Payout Chart
  const teamPayoutOption = {
    title: {
      text: 'Team Member Earnings',
      left: 'center',
      textStyle: { color: 'rgb(241, 245, 249)' }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        let result = `${params[0].axisValue}<br/>`;
        params.forEach(param => {
          result += `${param.seriesName}: $${param.value.toFixed(2)}<br/>`;
        });
        return result;
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: teamStatsData.map(t => t.username),
      axisLabel: {
        color: 'rgb(148, 163, 184)',
        rotate: 45
      }
    },
    yAxis: {
      type: 'value',
      name: 'Earnings ($)',
      nameTextStyle: { color: 'rgb(148, 163, 184)' },
      axisLabel: {
        color: 'rgb(148, 163, 184)',
        formatter: '${value}'
      },
      splitLine: {
        lineStyle: { color: '#334155' }
      }
    },
    series: [
      {
        name: 'Total Payout',
        type: 'bar',
        data: teamStatsData.map(t => t.totalPayout),
        itemStyle: { color: '#16a34a' },
        label: {
          show: true,
          position: 'top',
          formatter: '${c}',
          color: 'rgb(241, 245, 249)'
        }
      }
    ],
    backgroundColor: 'transparent'
  };

  const isLoadingAny = loadingRepoCommits || loadingRepoWinRates || loadingTeamStats || loadingTeamAccounts;

  return (
    <div style={{ padding: '24px', background: '#0f172a', minHeight: '100vh' }}>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={2} style={{ color: 'rgb(241, 245, 249)', margin: 0 }}>
            Statistics & Analytics
          </Title>
          <Text style={{ color: 'rgb(148, 163, 184)', fontSize: 14 }}>
            Comprehensive insights into commits, repositories, and team performance
          </Text>
        </Col>
        <Col>
          <Space>
            <Select
              value={timeRange}
              onChange={setTimeRange}
              style={{ width: 120 }}
              size="large"
            >
              <Option value={7}>Last 7 Days</Option>
              <Option value={30}>Last 30 Days</Option>
              <Option value={90}>Last 90 Days</Option>
              <Option value={365}>Last Year</Option>
            </Select>
            <Button
              icon={<ReloadOutlined />}
              onClick={fetchAllData}
              loading={isLoadingAny}
              size="large"
              style={{
                background: '#334155',
                borderColor: '#334155',
                color: 'rgb(241, 245, 249)'
              }}
            >
              Refresh
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Row 1: Repo Commits */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12}>
          <Card
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 12
            }}
            bodyStyle={{ padding: '20px' }}
          >
            {loadingRepoCommits ? (
              <Skeleton active paragraph={{ rows: 8 }} style={{ height: '400px' }} />
            ) : (
              <ReactECharts
                option={repoCommitsOption}
                style={{ height: '400px', width: '100%' }}
                opts={{ renderer: 'svg' }}
              />
            )}
          </Card>
        </Col>

        <Col xs={12}>
          <Card
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 12,
            }}
            bodyStyle={{ padding: '20px' }}
          >
            {loadingRepoWinRates ? (
              <Skeleton active paragraph={{ rows: 8 }} style={{ height: '400px' }} />
            ) : (
              <ReactECharts
                option={repoWinRatesOption}
                style={{ height: '400px', width: '100%' }}
                opts={{ renderer: 'svg' }}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Win rate per repo chart */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>

      </Row>

      {/* Row 2: Team Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={12}>
          <Card
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 12
            }}
            bodyStyle={{ padding: '20px' }}
          >
            {loadingTeamStats ? (
              <Skeleton active paragraph={{ rows: 8 }} style={{ height: '400px' }} />
            ) : teamStatsData.length > 0 ? (
              <ReactECharts
                option={teamStatsOption}
                style={{ height: '400px', width: '100%' }}
                opts={{ renderer: 'svg' }}
              />
            ) : null}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 12
            }}
            bodyStyle={{ padding: '20px' }}
          >
            {loadingTeamStats ? (
              <Skeleton active paragraph={{ rows: 8 }} style={{ height: '400px' }} />
            ) : teamStatsData.length > 0 ? (
              <ReactECharts
                option={teamPayoutOption}
                style={{ height: '400px', width: '100%' }}
                opts={{ renderer: 'svg' }}
              />
            ) : null}
          </Card>
        </Col>
      </Row>

      {/* Row 3: Team Accounts */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24}>
          <Card
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 12
            }}
            bodyStyle={{ padding: '20px' }}
          >
            {loadingTeamAccounts ? (
              <Skeleton active paragraph={{ rows: 8 }} style={{ height: '400px' }} />
            ) : teamAccounts.length > 0 && teamAccountsOption ? (
              <ReactECharts
                option={teamAccountsOption}
                style={{ height: '400px', width: '100%' }}
                opts={{ renderer: 'svg' }}
              />
            ) : null}
          </Card>
        </Col>
      </Row>

    </div>
  );
};

export default Statistics;
