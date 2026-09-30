// Payload sent with each job type. The job type is also the routing key.
export type JobPayloads = {
  'video.process': { assetId: string };
  'thumbnail.generate': { assetId: string };
};

export type JobType = keyof JobPayloads;
