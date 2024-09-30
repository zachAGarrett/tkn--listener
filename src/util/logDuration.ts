export const logDuration = (label: string, callback: () => any) => {
  console.time(label);
  return (() => {
    const res = callback();
    console.timeEnd(label);
    return res;
  })();
};
