import { redirect } from 'next/navigation';

export default function AuthRegisterPage() {
  redirect('/login?mode=register');
}
