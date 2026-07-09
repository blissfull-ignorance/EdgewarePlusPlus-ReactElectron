declare module 'fengari' {
  const lua: Record<string, any>
  const lauxlib: Record<string, any>
  const lualib: Record<string, any>
  export { lua, lauxlib, lualib }
}

declare module 'fengari-interop' {
  const interop: Record<string, any>
  export { interop }
}
