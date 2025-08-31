'use client';
import { getAuth } from "firebase/auth";

// A mock auth fetch. In a real app, this would use the user's token.
export async function authedFetch(url:string, options: any){
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken();
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
}
