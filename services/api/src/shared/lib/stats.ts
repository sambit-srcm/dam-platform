export const STATS_RETENTION_SECONDS = 90 * 24 * 60 * 60;

const formatUtcDate = (date: Date): string => {
  return date.toISOString().slice(0, 10);
};

export const downloadsDaykey = (date: Date): string => {
  return `stats:downloads:${formatUtcDate(date)}`;
};
