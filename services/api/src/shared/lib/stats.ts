// Download counts older than this are dropped, so the dashboard can't ask for more days
export const STATS_RETENTION_DAYS = 90;
export const STATS_RETENTION_SECONDS = STATS_RETENTION_DAYS * 24 * 60 * 60;

const formatUtcDate = (date: Date): string => {
  return date.toISOString().slice(0, 10);
};

export const downloadsDaykey = (date: Date): string => {
  return `stats:downloads:${formatUtcDate(date)}`;
};
