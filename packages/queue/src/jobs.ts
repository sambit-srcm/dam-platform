// Payload sent with each job type. The job type is also the routing key.
export type JobPayloads = {
  'image.process': { assetId: string };
  'video.process': { assetId: string };
};

export type JobType = keyof JobPayloads;
