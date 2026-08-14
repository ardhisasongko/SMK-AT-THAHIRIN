const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export function dateWIB(value: Date | number = Date.now()): string {
  const timestamp = value instanceof Date ? value.getTime() : value;
  return new Date(timestamp + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

export function timeWIB(value: Date | number = Date.now()): string {
  const timestamp = value instanceof Date ? value.getTime() : value;
  return new Date(timestamp + WIB_OFFSET_MS).toISOString().slice(11, 19);
}
