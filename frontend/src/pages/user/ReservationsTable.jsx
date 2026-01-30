import React from 'react';
import { Typography } from 'antd';

const { Title } = Typography;

const ReservationsTable = () => {
  return (
    <div>
      <Title level={2} style={{ color: 'rgb(241, 245, 249)' }}>
        Reservations
      </Title>
      <p style={{ color: 'rgb(148, 163, 184)' }}>Coming soon...</p>
    </div>
  );
};

export default ReservationsTable;
