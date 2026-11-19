import { useEffect, useRef } from "react";
import { initGame } from "./game/engine";

export default function App() {
  const arenaRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (arenaRef.current) initGame(arenaRef.current);
  }, []);

  return (
    <canvas
      ref={arenaRef}
      id="c"
      aria-label="Ball VS Ball arena. Choose Classic or Battle Mode. Select a ball, aim, and launch."
    />
  );
}
