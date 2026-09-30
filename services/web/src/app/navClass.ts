export const navClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-medium transition ${
    isActive ? 'text-gray-900' : 'text-gray-500 hover:text-gray-900'
  }`;
