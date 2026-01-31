import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Select, Typography, Spin, Space, Button, Radio } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

const Statistics = () => {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30);
  const [viewMode, setViewMode] = useState('daily');
  
  // Data states
  const [repoCommitsData, setRepoCommitsData] = useState([]);
  const [repoScoresData, setRepoScoresData] = useState([]);
  const [teamStatsData, setTeamStatsData] = useState([]);
  const [scoreDistribution, setScoreDistribution] = useState(null);
  const [earningsTimeline, setEarningsTimeline] = useState([]);
  const [earningsByRepo, setEarningsByRepo] = useState({ data: [], total: 0 });

  useEffect(() => {
    fetchAllData();
  }, [timeRange]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [repoCommits, repoScores, teamStats, scoreDist, earningsTime, earningsRepo] = await Promise.all([
        api.get('/stats/repo-commits'),
        api.get('/stats/repo-scores'),
        isAdmin() ? api.get('/stats/team-stats') : Promise.resolve({ data: { data: [] } }),
        api.get('/stats/score-distribution'),
        api.get(`/stats/earnings-timeline?days=${timeRange}`),
        api.get(`/stats/earnings-by-repo?days=${timeRange}`)
      ]);

      setRepoCommitsData(repoCommits.data.data || []);
      setRepoScoresData(repoScores.data.data || []);
      setTeamStatsData(teamStats.data.data || []);
      setScoreDistribution(scoreDist.data);
      setEarningsTimeline(earningsTime.data.data || []);
      setEarningsByRepo(earningsRepo.data);
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    } finally {
      setLoading(false);
    }
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

  // Repo Scores Chart
  const repoScoresOption = {
    title: {
      text: 'Average Scores by Repository',
      left: 'center',
      textStyle: { color: 'rgb(241, 245, 249)' }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' }
    },
    legend: {
      data: ['Habitat Score', 'Suitability Score', 'Difficulty Score'],
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
      data: repoScoresData.slice(0, 15).map(r => r.name),
      axisLabel: {
        color: 'rgb(148, 163, 184)',
        rotate: 45,
        interval: 0
      }
    },
    yAxis: {
      type: 'value',
      name: 'Score',
      nameTextStyle: { color: 'rgb(148, 163, 184)' },
      axisLabel: { color: 'rgb(148, 163, 184)' },
      splitLine: {
        lineStyle: { color: '#334155' }
      }
    },
    series: [
      {
        name: 'Habitat Score',
        type: 'bar',
        data: repoScoresData.slice(0, 15).map(r => Math.round(r.avgHabitatScore)),
        itemStyle: { color: '#16a34a' }
      },
      {
        name: 'Suitability Score',
        type: 'bar',
        data: repoScoresData.slice(0, 15).map(r => Math.round(r.avgSuitabilityScore)),
        itemStyle: { color: '#3b82f6' }
      },
      {
        name: 'Difficulty Score',
        type: 'bar',
        data: repoScoresData.slice(0, 15).map(r => Math.round(r.avgDifficultyScore)),
        itemStyle: { color: '#f59e0b' }
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

  // Score Distribution Chart
  const scoreDistributionOption = scoreDistribution && scoreDistribution.distribution ? {
    title: {
      text: 'Commit Score Distribution',
      subtext: `${scoreDistribution.total || 0} total commits`,
      left: 'center',
      textStyle: { color: 'rgb(241, 245, 249)' },
      subtextStyle: { color: 'rgb(148, 163, 184)' }
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      top: 'middle',
      textStyle: { color: 'rgb(148, 163, 184)' }
    },
    series: [
      {
        name: 'Score Distribution',
        type: 'pie',
        radius: '60%',
        data: [
          { value: scoreDistribution.distribution.tooEasy || 0, name: 'Too Easy (<50)', itemStyle: { color: '#8b5cf6' } },
          { value: scoreDistribution.distribution.easy || 0, name: 'Easy (50-79)', itemStyle: { color: '#3b82f6' } },
          { value: scoreDistribution.distribution.inDistribution || 0, name: 'In Distribution (80-119)', itemStyle: { color: '#16a34a' } },
          { value: scoreDistribution.distribution.hard || 0, name: 'Hard (120-149)', itemStyle: { color: '#f59e0b' } },
          { value: scoreDistribution.distribution.tooHard || 0, name: 'Too Hard (≥150)', itemStyle: { color: '#ef4444' } },
          { value: scoreDistribution.distribution.unsuitable || 0, name: 'Unsuitable', itemStyle: { color: '#64748b' } }
        ].filter(item => item.value > 0), // Filter out zero values
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        },
        label: {
          show: true,
          formatter: '{b}: {c}\n({d}%)',
          color: 'rgb(241, 245, 249)'
        },
        labelLine: {
          show: true
        }
      }
    ],
    backgroundColor: 'transparent'
  } : {
    title: {
      text: 'Commit Score Distribution',
      left: 'center',
      textStyle: { color: 'rgb(241, 245, 249)' }
    },
    graphic: {
      type: 'text',
      left: 'center',
      top: 'middle',
      style: {
        text: 'No data available',
        fontSize: 16,
        fill: 'rgb(148, 163, 184)'
      }
    },
    backgroundColor: 'transparent'
  };

  // Earnings Timeline Chart
  const earningsTimelineOption = {
    title: {
      text: 'Earnings Over Time',
      left: 'center',
      textStyle: { color: 'rgb(241, 245, 249)' }
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        let result = `${params[0].axisValue}<br/>`;
        params.forEach(param => {
          result += `${param.seriesName}: $${param.value.toFixed(2)}<br/>`;
        });
        return result;
      }
    },
    legend: {
      data: ['Total', 'Easy', 'In Distribution'],
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
      boundaryGap: false,
      data: earningsTimeline.map(d => dayjs(d.date).format('MMM DD')),
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
        name: 'Total',
        type: 'line',
        stack: 'Total',
        areaStyle: {},
        data: earningsTimeline.map(d => d.total),
        itemStyle: { color: '#16a34a' },
        smooth: true
      },
      {
        name: 'Easy',
        type: 'line',
        stack: 'Easy',
        areaStyle: {},
        data: earningsTimeline.map(d => d.easy),
        itemStyle: { color: '#3b82f6' },
        smooth: true
      },
      {
        name: 'In Distribution',
        type: 'line',
        stack: 'In Distribution',
        areaStyle: {},
        data: earningsTimeline.map(d => d.inDistribution),
        itemStyle: { color: '#f59e0b' },
        smooth: true
      }
    ],
    backgroundColor: 'transparent'
  };

  // Earnings by Repo Chart
  const earningsByRepoOption = {
    title: {
      text: 'Earnings by Repository',
      subtext: `Total: $${earningsByRepo.total?.toFixed(2) || 0}`,
      left: 'center',
      textStyle: { color: 'rgb(241, 245, 249)' },
      subtextStyle: { color: 'rgb(148, 163, 184)' }
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: ${c} ({d}%)'
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
        name: 'Earnings',
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
          formatter: '{b}: ${c}',
          color: 'rgb(241, 245, 249)'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold'
          }
        },
        data: earningsByRepo.data.slice(0, 20).map(item => ({
          value: item.value,
          name: item.name
        }))
      }
    ],
    backgroundColor: 'transparent'
  };

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

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

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
              loading={loading}
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

      {/* Row 1: Repo Commits & Score Distribution */}
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
            <ReactECharts
              option={repoCommitsOption}
              style={{ height: '400px', width: '100%' }}
              opts={{ renderer: 'svg' }}
            />
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
            <ReactECharts
              option={scoreDistributionOption}
              style={{ height: '400px', width: '100%' }}
              opts={{ renderer: 'svg' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Row 2: Repo Scores */}
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
            <ReactECharts
              option={repoScoresOption}
              style={{ height: '400px', width: '100%' }}
              opts={{ renderer: 'svg' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Row 3: Earnings Charts */}
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
            <ReactECharts
              option={earningsTimelineOption}
              style={{ height: '400px', width: '100%' }}
              opts={{ renderer: 'svg' }}
            />
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
            <ReactECharts
              option={earningsByRepoOption}
              style={{ height: '400px', width: '100%' }}
              opts={{ renderer: 'svg' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Row 4: Team Stats (Admin only) */}
      {isAdmin() && teamStatsData.length > 0 && (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card
              style={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 12
              }}
              bodyStyle={{ padding: '20px' }}
            >
              <ReactECharts
                option={teamStatsOption}
                style={{ height: '400px', width: '100%' }}
                opts={{ renderer: 'svg' }}
              />
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
              <ReactECharts
                option={teamPayoutOption}
                style={{ height: '400px', width: '100%' }}
                opts={{ renderer: 'svg' }}
              />
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};

export default Statistics;
