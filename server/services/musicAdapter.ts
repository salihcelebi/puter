function fail(message: string, code: string): never {
  throw Object.assign(new Error(message), { code });
}

export const musicAdapter = {
  // Part 4: keep music behavior honest until a real adapter + pricing path exists.
  async getCapability() {
    return {
      supported: false,
      mode: 'capability_only',
      code: 'FEATURE_NOT_READY',
      reason: 'Music üretimi bu sürümde devre dışı; sahte başarı veya sahte kredi düşümü yok.',
    };
  },

  async generateMusic(_userId?: string, _prompt?: string, _tags?: string[]) {
    const capability = await this.getCapability();
    fail(capability.reason, capability.code);
  },
};
