import { Database, Key, CheckCircle2, AlertCircle } from 'lucide-react';

export default function Setup() {
  const hasUrl = !!import.meta.env.VITE_SUPABASE_URL;
  const hasKey = !!import.meta.env.VITE_SUPABASE_ANON_KEY;
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        <div className="bg-indigo-600 p-8 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <Database className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Welcome to Nexus Ledger</h1>
          <p className="text-indigo-100">Let's connect your Supabase database to get started.</p>
        </div>
        
        <div className="p-8">
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">1</div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Create a Supabase Project</h3>
                <p className="text-gray-600 mt-1">Go to <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">supabase.com</a> and create a new project.</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">2</div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Run the Database Schema</h3>
                <p className="text-gray-600 mt-1">In your Supabase SQL Editor, run the schema provided in the <code>schema.sql</code> file of this project to create the necessary tables.</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">3</div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Add Environment Variables</h3>
                <p className="text-gray-600 mt-1">Open the AI Studio Settings menu and add the following secrets:</p>
                <div className="mt-3 bg-gray-50 p-4 rounded-lg border border-gray-200 font-mono text-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-800 font-semibold">VITE_SUPABASE_URL</span>
                    {hasUrl ? <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" /> : <AlertCircle className="w-4 h-4 text-red-500 ml-auto" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-800 font-semibold">VITE_SUPABASE_ANON_KEY</span>
                    {hasKey ? <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" /> : <AlertCircle className="w-4 h-4 text-red-500 ml-auto" />}
                  </div>
                </div>
                {(!hasUrl || !hasKey) && (
                  <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    Keys not detected. If you just added them, try refreshing the page.
                  </p>
                )}
              </div>
            </div>
          </div>
          
          <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-center gap-2 text-sm text-gray-500">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            The app will automatically reload once configured.
          </div>
        </div>
      </div>
    </div>
  );
}
