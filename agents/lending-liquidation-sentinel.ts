 name: "lending-liquidation-sentinel",
 version: "0.1.0",
 description: "Lending liquidation monitoring agent",
 key: "monitor",
 description: "Monitor lending positions for liquidation risk",
 input: z.object({
   wallet: z.string().substring(0, 42), // wallet address (42 characters)
   protocol_ids: z.array(z.string()).optional(),
   positions: z.array(z.string()).optional()
 }),
 output: {
   health_factor: z.number(),
   liq_price: z.string(),
   buffer_percent: z.number(),
   alert_threshold_hit: z.boolean()
 }
 key: "monitor",
 description: "Monitor wallet for liquidation risk",
 input: z.object({
   wallet: z.string().substring(0, 42).optional(), // wallet address
   protocol_ids: z.array(z.string()).optional(), // array of protocol IDs
   positions: z.array(z.string()).optional() // array of position IDs
 }),
 output: {
   health_factor: z.number(),
   liq_price: z.string(),
   buffer_percent: z.number(),
   alert_threshold_hit: z.boolean()
 }
 key: "monitor",
 description: "Monitor health factor and trigger alerts near liquidation",
 input: z.object({ 
   wallet: z.string().substring(0, 42) 
 }),
 output: {
   health_factor: z.number(),
   liq_price: z.string(),
   buffer_percent: z.number(),
   alert_threshold_hit: z.boolean()
 }
 key: "monitor",
 description: "Monitor health factor and trigger alerts near liquid