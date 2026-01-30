import { theme } from 'antd';

export const appTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#16a34a', // Emerald green from Electron app
    borderRadius: 12,
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    colorBgContainer: '#1e293b', // slate-800 (solid)
    colorBorder: '#334155', // slate-700 (solid)
    colorText: 'rgb(241, 245, 249)', // slate-100
    colorTextSecondary: 'rgb(148, 163, 184)', // slate-400
  },
  components: {
    Layout: {
      bodyBg: '#0f172a', // slate-900
      headerBg: '#1e293b', // slate-800 (solid)
      siderBg: '#0f172a', // slate-900
    },
    Menu: {
      darkItemBg: '#0f172a', // slate-900
      darkSubMenuItemBg: '#1e293b', // slate-800 (solid)
      darkItemSelectedBg: '#16a34a', // primary green
      darkItemHoverBg: '#334155', // slate-700 (solid)
      darkItemSelectedColor: '#fff',
      darkItemColor: 'rgb(148, 163, 184)', // slate-400
      darkItemHoverColor: 'rgb(226, 232, 240)', // slate-200
      darkBg: '#0f172a', // slate-900
    },
    Card: {
      colorBgContainer: '#1e293b', // slate-800 (solid)
      colorBorderSecondary: '#334155', // slate-700 (solid)
      borderRadius: 12,
    },
    Input: {
      colorBgContainer: '#0f172a', // slate-900
      colorBorder: '#334155', // slate-700 (solid)
      colorText: 'rgb(241, 245, 249)', // slate-100
      colorTextPlaceholder: 'rgb(100, 116, 139)', // slate-500
      hoverBorderColor: '#16a34a',
      activeBorderColor: '#16a34a',
    },
    Button: {
      colorPrimary: '#16a34a',
      colorPrimaryHover: '#15803d', // primary-600
      colorPrimaryActive: '#166534', // primary-700
      borderRadius: 8,
    },
    Dropdown: {
      colorBgElevated: '#1e293b', // slate-800 (solid)
      colorText: 'rgb(241, 245, 249)', // slate-100
      borderRadius: 12,
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
    },
    Spin: {
      colorPrimary: '#16a34a', // emerald green
    },
    Skeleton: {
      colorFill: '#1e293b', // slate-800 (solid)
      colorFillContent: '#334155', // slate-700 (solid)
    },
    DatePicker: {
      colorBgContainer: '#0f172a', // slate-900
      colorBorder: '#334155', // slate-700 (solid)
      colorText: 'rgb(241, 245, 249)', // slate-100
      colorTextPlaceholder: 'rgb(100, 116, 139)', // slate-500
      colorPrimary: '#16a34a',
    },
    Modal: {
      contentBg: '#1e293b', // slate-800 (solid)
      headerBg: '#1e293b', // slate-800 (solid)
      titleColor: 'rgb(241, 245, 249)', // slate-100
      colorText: 'rgb(241, 245, 249)', // slate-100
    },
    Select: {
      colorBgContainer: '#0f172a', // slate-900
      colorBorder: '#334155', // slate-700 (solid)
      colorText: 'rgb(241, 245, 249)', // slate-100
      colorTextPlaceholder: 'rgb(100, 116, 139)', // slate-500
      multipleItemBg: '#1e293b', // slate-800 (solid) for selected tags
      multipleItemBorderColor: '#334155', // slate-700 (solid)
    },
    Switch: {
      colorPrimary: '#16a34a',
      colorPrimaryHover: '#15803d',
    },
    Table: {
      colorBgContainer: '#1e293b', // slate-800 (solid)
      colorBorderSecondary: '#334155', // slate-700 (solid)
      colorText: 'rgb(241, 245, 249)', // slate-100
      colorTextHeading: 'rgb(241, 245, 249)', // slate-100
      rowHoverBg: '#334155', // slate-700 (solid)
    },
    Tag: {
      colorPrimary: '#16a34a',
      colorPrimaryBg: 'rgba(22, 163, 74, 0.1)',
    },
  },
};
