export async function writeMapValue(tenant, { mapTail, key, value }) {
  const mapName = tenant.canonicalName(mapTail);
  const result = await tenant.executeControl("map-entry-set", {
    map_name: mapName,
    key,
    value,
  });

  return {
    mapName,
    key,
    bytes: Buffer.byteLength(value, "utf8"),
    result,
  };
}
