import React from 'react';
import { Typography } from 'antd';

const { Title } = Typography;

const SuccessfulTasks = () => {
  return (
    <div>
      <Title level={2} style={{ color: 'rgb(241, 245, 249)' }}>
        Successful Tasks
      </Title>
      <p style={{ color: 'rgb(148, 163, 184)' }}>Coming soon...</p>
    </div>
  );
};

export default SuccessfulTasks;
