'use client';

import Image, { ImageProps } from 'next/image';
import { useState } from 'react';

type Props = Omit<ImageProps, 'placeholder' | 'onLoadingComplete'> & {
  fadeMs?: number;
};
export default function SmoothImage({
  fadeMs = 250,
  priority = false,
  ...props
}: Props) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      style={{
        position: props.fill ? 'absolute' : 'relative',
        inset: props.fill ? 0 : undefined,
        transition: `opacity ${fadeMs}ms ease`,
        opacity: loaded ? 1 : 0.001,
      }}
    >
      <Image
        {...props}
        priority={priority}
        placeholder="empty"
        onLoadingComplete={() => setLoaded(true)}
      />
    </div>
  );
}
