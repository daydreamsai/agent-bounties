 name: "yield-pool-watcher",
 version: "0.1.0",
 description: "Track APY and TVL across pools and alert on changes",
 key: "monitor",
 description: "Monitor pool metrics and alert on sharp changes",
 input: z.object({ 
   protocol_ids: z.array(z.string()).optional(), 
   pools: z.array(z.string()).optional(),
   threshold_rules: z.object({
     tvl: z.number().optional(),
     apy: z.number().optional()
   }).optional()
 }),
 async handler({ input }) {
   return {
     output: { 
       pool_metrics: z.record(z.string(), z.any()).optional(),
       deltas: z.record(z.string(), z.any()).optional(),
       alerts: z.array(z.string()).optional()
     },
     usage: { total_tokens: z.number().optional() }
   };
 },