import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface ComponentLoaderProps {
  delay: number;
  children: React.ReactNode;
  skeletonHeight?: number;
  loaded?: boolean;
}

export default function ComponentLoader({ delay, children, skeletonHeight = 80, loaded }: ComponentLoaderProps) {
  const [show, setShow] = useState(loaded ?? false);

  useEffect(() => {
    if (loaded !== undefined) {
      setShow(loaded);
      return;
    }
    const timer = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(timer);
  }, [delay, loaded]);

  return (
    <AnimatePresence mode="wait">
      {!show ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.15 }}
          className="skeleton rounded-xl"
          style={{ height: skeletonHeight }}
        />
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
