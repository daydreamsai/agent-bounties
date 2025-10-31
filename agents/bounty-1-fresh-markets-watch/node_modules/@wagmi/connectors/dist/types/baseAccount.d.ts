import type { createBaseAccountSDK, ProviderInterface } from '@base-org/account';
import type { Mutable, Omit } from '@wagmi/core/internal';
export type BaseAccountParameters = Mutable<Omit<Parameters<typeof createBaseAccountSDK>[0], 'appChainIds'>>;
export declare function baseAccount(parameters?: BaseAccountParameters): import("@wagmi/core").CreateConnectorFn<ProviderInterface, Record<string, unknown>, Record<string, unknown>>;
//# sourceMappingURL=baseAccount.d.ts.map