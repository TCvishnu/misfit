import { useEffect, useState } from "react";

function LoadingDots() {
  const [dots, setDots] = useState(0);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev === 3) {
          setDirection(-1);
          return 2;
        }

        if (prev === 0) {
          setDirection(1);
          return 1;
        }

        return prev + direction;
      });
    }, 400);

    return () => clearInterval(interval);
  }, [direction]);

  return (
    <span className="inline-block w-4 text-center">
      {".".repeat(dots)}
    </span>
  );
}

export default LoadingDots;