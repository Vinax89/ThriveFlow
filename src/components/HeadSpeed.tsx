/**
 * Auto-added by apply-integrated-patch on 2024-08-01T04:50:56.289Z
 * Safe to edit.
 */

import React from 'react';

/** Lightweight <head> perf hints for Firebase stack */
export default function HeadSpeed() {
  return (
    <>
      <meta httpEquiv="x-dns-prefetch-control" content="on" />
      <link rel="dns-prefetch" href="//firestore.googleapis.com" />
      <link rel="dns-prefetch" href="//www.googleapis.com" />
      <link rel="dns-prefetch" href="//securetoken.googleapis.com" />
      <link rel="dns-prefetch" href="//www.gstatic.com" />
      <link rel="preconnect" href="https://firestore.googleapis.com" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://www.googleapis.com" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://securetoken.googleapis.com" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://www.gstatic.com" crossOrigin="anonymous" />
      <meta name="font-display" content="swap" />
    </>
  );
}
