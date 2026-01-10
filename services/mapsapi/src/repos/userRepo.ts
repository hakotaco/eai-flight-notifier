// Deprecated: Local user storage has been removed. Users are sourced from the main dashboard.
// This stub remains only to avoid breaking imports if any external code references it.
export class UserRepo {
  async list(): Promise<any[]> {
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async add(..._args: any[]): Promise<never> {
    throw new Error('UserRepo is deprecated. Users come from the external dashboard.');
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async findById(..._args: any[]): Promise<undefined> {
    return undefined;
  }
}
