import { useEffect, useState } from "react";

export default function useHover(ref: any) {
  const [hover, setHover] = useState(false);
  const onMouseEnter = () => setHover(true);
  const onMouseOut = () => setHover(false);

  useEffect(() => {
    const target = ref.current;
    if (target) {
      target.addEventListener("mouseenter", onMouseEnter);
      target.addEventListener("mouseout", onMouseOut);
      return () => {
        target.removeEventListener("mouseenter", onMouseEnter);
        target.removeEventListener("mouseout", onMouseOut);
      };
    }
  });
  return [hover];
}
