import { z } from "zod";

const hour = z.number().int().min(0).max(23);

/** PushSubscription.toJSON() 모양. 엔드포인트는 브라우저 푸시 서비스의 https 주소여야 한다. */
export const pushSubscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
});

export const quietHoursSchema = z.object({ quietStart: hour, quietEnd: hour });

export const savePushSchema = pushSubscriptionSchema.extend(quietHoursSchema.shape);
export const endpointSchema = z.url({ protocol: /^https$/ }).max(1000);
