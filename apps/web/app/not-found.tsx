import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileQuestion, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-sm w-full text-center space-y-5">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <FileQuestion className="h-8 w-8 text-gray-400" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Página não encontrada</h1>
          <p className="mt-2 text-sm text-gray-500">
            A página que você procura não existe ou foi movida.
          </p>
        </div>
        <Link href="/dashboard">
          <Button className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            Voltar ao dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
