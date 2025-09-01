/**
 * Auto-added by apply-integrated-patch on 2024-08-01T04:50:56.289Z
 * Safe to edit.
 */

'use client';
import Image, { ImageProps } from 'next/image';
import React, { useState } from 'react';

type Props = Omit<ImageProps, 'placeholder' | 'onLoadingComplete'> & { fadeMs?: number };

export default function SmoothImage({ fadeMs = 250, priority = false, ...props }: Props) {
  const [loaded, setLoaded] = useState(false);
  const wrapperStyle: React.CSSProperties = props.fill
    ? { position: 'absolute', inset: 0 }
    : { position: 'relative', display: 'block' };
  return (
    <div style={{ ...wrapperStyle, transition: `opacity ${'${fadeMs}'}ms ease`, opacity: loaded ? 1 : 0.001 }}>
      <Image {...props} priority={priority} placeholder="empty" onLoadingComplete={() => setLoaded(true)} />
    </div>
  );
}
