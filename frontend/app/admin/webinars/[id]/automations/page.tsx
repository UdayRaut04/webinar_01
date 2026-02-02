'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatTime } from '@/lib/utils';

interface Automation {
  id: string;
  type: string;
  triggerAt: number;
  content: string;
  enabled: boolean;
  executed: boolean;
}

export default function AutomationsPage() {
  const params = useParams();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    type: 'TIMED_MESSAGE',
    triggerAt: 60,
    content: '',
    senderName: 'Webinar Bot',
  });

  useEffect(() => {
    loadAutomations();
  }, [params.id]);

  const loadAutomations = async () => {
    try {
      const { automations } = await api.getAutomations(params.id as string);
      setAutomations(automations);
    } catch (error) {
      console.error('Failed to load automations:', error);
    } finally {
      setLoading(false);
    }
  };
// Add state for CSV file
 const [csvFile, setCsvFile] = useState<File | null>(null);

// Add CSV upload handler
const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  
  // Get auth token from localStorage
  const token = localStorage.getItem('token');
  
  const formData = new FormData();
  formData.append('csv', file);
  formData.append('webinarId', params.id as string);
  
  try {
    const response = await fetch('http://localhost:4000/api/admin/automations/csv', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });
    
    if (response.ok) {
      const result = await response.json();
      alert(`Successfully uploaded ${result.count} automations!`);
      loadAutomations();
    } else {
      const error = await response.json();
      alert(`Upload failed: ${error.error}`);
    }
  } catch (error) {
    alert('Upload failed - check console for details');
  }
};

// Add to the UI (around the automation creation form):
<div className="mb-6">
  <label className="block text-sm font-medium mb-2">Upload CSV Automation</label>
  <input
    type="file"
    accept=".csv"
    onChange={handleCsvUpload}
    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
  />
  <p className="text-xs text-gray-500 mt-1">
    CSV format: Hour,Minute,Second,Name,Message,Mode
  </p>
</div>

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let content: any = { message: formData.content };
      
      if (formData.type === 'TIMED_MESSAGE') {
        content = { senderName: formData.senderName, message: formData.content };
      } else if (formData.type === 'CTA_POPUP') {
        content = JSON.parse(formData.content);
      }

      await api.createAutomation(params.id as string, {
        type: formData.type,
        triggerAt: formData.triggerAt,
        content: JSON.stringify(content),
      });
      
      toast.success('Automation created');
      loadAutomations();
      setFormData({ type: 'TIMED_MESSAGE', triggerAt: 60, content: '', senderName: 'Webinar Bot' });
    } catch (error: any) {
      toast.error(error.message || 'Failed to create automation');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this automation?')) return;
    
    try {
      await api.deleteAutomation(id);
      toast.success('Automation deleted');
      setAutomations((prev) => prev.filter((a) => a.id !== id));
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete automation');
    }
  };

  const automationTypes = [
    { value: 'TIMED_MESSAGE', label: 'Timed Chat Message' },
    { value: 'CTA_POPUP', label: 'CTA Popup' },
    { value: 'OFFER_BANNER', label: 'Offer Banner' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold">Automations</h1>

      {/* Create Form */}
      <Card>
        <CardHeader>
          <CardTitle>Add Automation</CardTitle>
        </CardHeader>
        <CardContent>
  {/* Add CSV upload section */}
  <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
    <h3 className="font-medium text-blue-800 mb-2">Upload CSV Automations</h3>
    <input
  type="file"
  accept=".csv"  // Changed from .xlsx to .csv
  onChange={handleCsvUpload}
  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200"
/>
    <p className="text-xs text-blue-600 mt-1">
      Format: Hour,Minute,Second,Name,Message,Mode
    </p>
  </div>
  
  {/* Rest of existing form */}
  <form onSubmit={handleCreate} className="space-y-4">
    {/* ... existing form fields ... */}
  </form>
</CardContent>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Type"
                options={automationTypes}
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              />
              <Input
                label="Trigger At (seconds into webinar)"
                type="number"
                min="0"
                value={formData.triggerAt.toString()}
                onChange={(e) => setFormData({ ...formData, triggerAt: parseInt(e.target.value) || 0 })}
              />
            </div>

            {formData.type === 'TIMED_MESSAGE' && (
              <Input
                label="Sender Name"
                value={formData.senderName}
                onChange={(e) => setFormData({ ...formData, senderName: e.target.value })}
              />
            )}

            <Textarea
              label={formData.type === 'TIMED_MESSAGE' ? 'Message' : 'Content (JSON)'}
              placeholder={
                formData.type === 'TIMED_MESSAGE'
                  ? 'Enter the message to send...'
                  : '{"title": "Special Offer", "description": "...", "buttonText": "...", "buttonUrl": "..."}'
              }
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              rows={4}
            />

            <Button type="submit">Add Automation</Button>
          </form>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Automations</CardTitle>
        </CardHeader>
        <CardContent>
          {automations.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No automations yet</p>
          ) : (
            <div className="divide-y">
              {automations.map((automation) => {
                let content;
                try {
                  content = JSON.parse(automation.content);
                } catch {
                  content = { message: automation.content };
                }

                return (
                  <div key={automation.id} className="py-4 flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{automation.type}</span>
                        <span className="text-sm text-gray-500">
                          at {formatTime(automation.triggerAt)}
                        </span>
                        {automation.executed && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                            Executed
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {content.message || content.title || automation.content.slice(0, 100)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(automation.id)}
                    >
                      Delete
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
