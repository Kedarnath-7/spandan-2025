'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { exportService } from '@/lib/services/exportService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Search,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Calendar,
  Mail,
  Phone,
  GraduationCap,
  MapPin,
  CreditCard,
  ImageIcon,
  Download,
  Loader2,
  RefreshCw,
  AlertTriangle,
  X,
  Copy,
  Eye,
  IndianRupee
} from 'lucide-react';
import { 
  getEventRegistrations, 
  getEventRegistrationByGroupId, 
  approveEventRegistration, 
  rejectEventRegistration,
  deleteEventRegistration 
} from '@/lib/services/eventRegistrationService';
import type { EventRegistrationAdmin, EventRegistration, EventRegistrationMember } from '@/lib/types';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';

export default function AdminEventRegistrationsPage() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [registrations, setRegistrations] = useState<EventRegistrationAdmin[]>([]);
  const [filteredRegistrations, setFilteredRegistrations] = useState<EventRegistrationAdmin[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    totalRevenue: 0
  });
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  
  // Selection and Actions
  const [selectedRegistration, setSelectedRegistration] = useState<(EventRegistration & { members: EventRegistrationMember[]; event_category?: string }) | null>(null);
  const [showRegistrationDetails, setShowRegistrationDetails] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showPaymentProof, setShowPaymentProof] = useState(false);
  const [paymentProofUrl, setPaymentProofUrl] = useState<string>('');

  // Load registrations data with enhanced error handling and stats calculation
  const loadRegistrations = useCallback(async () => {
    setLoadingData(true);
    try {
      console.log('Loading event registrations...');
      const result = await getEventRegistrations();
      
      if (result.success && result.data) {
        console.log('Event registrations loaded:', result.data.length);
        setRegistrations(result.data);
        setFilteredRegistrations(result.data);
        
        // Update stats
        const newStats = {
          total: result.data.length,
          pending: result.data.filter((r: EventRegistrationAdmin) => r.status === 'pending').length,
          approved: result.data.filter((r: EventRegistrationAdmin) => r.status === 'approved').length,
          rejected: result.data.filter((r: EventRegistrationAdmin) => r.status === 'rejected').length,
          totalRevenue: result.data
            .filter((r: EventRegistrationAdmin) => r.status === 'approved')
            .reduce((sum: number, r: EventRegistrationAdmin) => sum + (r.total_amount || 0), 0)
        };
        setStats(newStats);
      } else {
        toast({
          title: "Error",
          description: "Failed to load event registrations",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error loading event registrations:', error);
      toast({
        title: "Error",
        description: "Failed to load event registrations. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingData(false);
    }
  }, [toast]);

  // Initial load
  useEffect(() => {
    loadRegistrations();
  }, [loadRegistrations]);

  // Filter and sort registrations
  useEffect(() => {
    let filtered = [...registrations];
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(registration => 
        (registration.leader_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (registration.leader_email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (registration.leader_phone || '').includes(searchTerm) ||
        (registration.event_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (registration.group_id || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(registration => registration.status === statusFilter);
    }
    
    // Apply event filter
    if (eventFilter !== 'all') {
      filtered = filtered.filter(registration => registration.event_name === eventFilter);
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        case 'oldest':
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        case 'name':
          return (a.leader_name || '').localeCompare(b.leader_name || '');
        case 'status':
          return (a.status || '').localeCompare(b.status || '');
        case 'amount':
          return (b.total_amount || 0) - (a.total_amount || 0);
        default:
          return 0;
      }
    });
    
    setFilteredRegistrations(filtered);
  }, [registrations, searchTerm, statusFilter, eventFilter, sortBy]);

  // Handle registration actions
  const handleViewDetails = async (groupId: string) => {
    try {
      setProcessingId(groupId);
      const result = await getEventRegistrationByGroupId(groupId);
      
      if (result.success && result.data) {
        setSelectedRegistration(result.data);
        setShowRegistrationDetails(true);
      } else {
        toast({
          title: "Error",
          description: "Failed to load registration details",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error loading registration details:', error);
      toast({
        title: "Error", 
        description: "Error loading registration details",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleApprove = async (groupId: string) => {
    try {
      setProcessingId(groupId);
      const result = await approveEventRegistration(groupId, 'admin');
      if (result.success) {
        // Fetch registration details for email
        const regResult = await getEventRegistrationByGroupId(groupId);
        if (regResult.success && regResult.data) {
          // Fetch email template
          const { getEmailTemplate } = await import('@/lib/services/emailTemplateService');
          const { sendApprovalEmail } = await import('@/lib/services/emailService');
          const template = await getEmailTemplate('approval_event');
          // Prepare user data for template
          const user = {
            ...regResult.data,
            group_members: regResult.data.members?.map(m => `${m.name} (${m.user_id})`).join(', ')
          };
          
          console.log('=== ADMIN PAGE EMAIL DEBUG ===');
          console.log('Group ID:', groupId);
          console.log('Registration data keys:', Object.keys(regResult.data));
          console.log('Event name in data:', regResult.data.event_name);
          console.log('User object for email:', JSON.stringify(user, null, 2));
          console.log('Template type:', template?.type);
          
          try {
            await sendApprovalEmail({ user, template });
          } catch (emailError) {
            console.error('Error sending approval email:', emailError);
          }
        }
        toast({
          title: "Success",
          description: "Registration approved and email sent!",
        });
        await loadRegistrations();
      } else {
        toast({
          title: "Error",
          description: "Failed to approve registration",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error approving registration:', error);
      toast({
        title: "Error",
        description: "Error approving registration",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!selectedRegistration || !rejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a rejection reason",
        variant: "destructive",
      });
      return;
    }

    try {
      setProcessingId(selectedRegistration.group_id);
      const result = await rejectEventRegistration(
        selectedRegistration.group_id,
        rejectionReason,
        'admin'
      );
      
      if (result.success) {
        toast({
          title: "Success",
          description: "Registration rejected successfully",
        });
        setShowRejectDialog(false);
        setRejectionReason('');
        await loadRegistrations();
      } else {
        toast({
          title: "Error",
          description: "Failed to reject registration",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error rejecting registration:', error);
      toast({
        title: "Error",
        description: "Error rejecting registration",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  // Show payment proof dialog
  const handleShowPaymentProof = async (screenshotPath: string) => {
    try {
      if (!screenshotPath) {
        toast({
          title: "Error",
          description: "No payment proof available",
          variant: "destructive",
        });
        return;
      }

      // Get the public URL for the screenshot
      const { data } = supabase.storage
        .from('spandan-assets')
        .getPublicUrl(screenshotPath);

      if (data?.publicUrl) {
        setPaymentProofUrl(data.publicUrl);
        setShowPaymentProof(true);
      } else {
        toast({
          title: "Error",
          description: "Failed to load payment proof",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error loading payment proof:', error);
      toast({
        title: "Error",
        description: "Error loading payment proof",
        variant: "destructive",
      });
    }
  };

  // Export to CSV using database view
  const exportToCSV = async () => {
    try {
      await exportService.exportEventRegistrationsCSV();
      toast({
        title: "Export Successful",
        description: "Event registration data has been exported to CSV.",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export event registration data. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500 text-white"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500 text-white"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500 text-white"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  // Get unique events for filter
  const uniqueEvents = Array.from(new Set(registrations.map(reg => reg.event_name)));

  // Loading state
  if (loadingData) {
    return (
      <div className="min-h-screen bg-[#0A0F1A] text-white relative overflow-hidden">
        <Navigation />
        <div className="relative z-10 pt-32 pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <Loader2 className="w-12 h-12 animate-spin text-cyan-400 mx-auto mb-4" />
                <p className="text-gray-300">Loading event registrations...</p>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0F1A] text-white relative overflow-hidden">
      <Navigation />
      
      <div className="relative z-10 pt-32 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <Button
                onClick={() => router.push('/admin/dashboard')}
                variant="outline"
                className=" bg-blue-600/20 border-blue-200/50 text-white hover:border-blue-300 hover:text-black"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
              
              <div className="flex items-center gap-4">
                <Button
                  onClick={loadRegistrations}
                  variant="outline"
                  className=" bg-blue-600/20 border-blue-200/50 text-white hover:border-blue-300 hover:text-black"
                  disabled={loadingData}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loadingData ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                
                <Button
                  onClick={exportToCSV}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
            
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
                Registration Management
              </h1>
              <p className="text-gray-300 text-lg">
                Unified view of all event registrations
              </p>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <Card className="bg-blue-900/30 border-blue-400/30 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="text-center">
                  <Users className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">{stats.total}</p>
                  <p className="text-sm text-gray-300">Total</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-yellow-900/30 border-yellow-400/30 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="text-center">
                  <Clock className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">{stats.pending}</p>
                  <p className="text-sm text-gray-300">Pending</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-green-900/30 border-green-400/30 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="text-center">
                  <CheckCircle className="w-6 h-6 text-green-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">{stats.approved}</p>
                  <p className="text-sm text-gray-300">Approved</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-red-900/30 border-red-400/30 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="text-center">
                  <XCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">{stats.rejected}</p>
                  <p className="text-sm text-gray-300">Rejected</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-green-900/30 border-green-400/30 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="text-center">
                  <IndianRupee className="w-6 h-6 text-green-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">₹{stats.totalRevenue.toLocaleString()}</p>
                  <p className="text-sm text-gray-300">Total Revenue</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-purple-900/30 border-purple-400/30 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="text-center">
                  <GraduationCap className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">{stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0}%</p>
                  <p className="text-sm text-gray-300">Approval Rate</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Search */}
          <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm mb-8">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Search registrations...</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search by name, email, event..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 bg-slate-700 border-slate-600 text-white placeholder-gray-400"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">All Statuses</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">All Events</label>
                  <Select value={eventFilter} onValueChange={setEventFilter}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Events</SelectItem>
                      {uniqueEvents.map(event => (
                        <SelectItem key={event} value={event}>{event}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Newest First</label>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest First</SelectItem>
                      <SelectItem value="oldest">Oldest First</SelectItem>
                      <SelectItem value="name">Name (A-Z)</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                      <SelectItem value="amount">Amount (High-Low)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button 
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    setEventFilter('all');
                    setSortBy('newest');
                  }}
                  variant="outline"
                  className=" bg-blue-600/20 border-blue-200/50 text-white hover:border-blue-300 hover:text-black"
                >
                  Clear Filters
                </Button>
              </div>
              
              <div className="mt-4 text-sm text-gray-400">
                Showing {filteredRegistrations.length} of {stats.total} registrations
              </div>
            </CardContent>
          </Card>

          {/* Event Registrations List */}
          <div className="space-y-4">
            {filteredRegistrations.length === 0 ? (
              <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
                <CardContent className="p-12">
                  <div className="text-center">
                    <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-300 mb-2">No registrations found</h3>
                    <p className="text-gray-400">No event registrations match your current filters.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              filteredRegistrations.map((registration) => (
                <Card key={registration.group_id} className="bg-gray-900/50 border-gray-600/30 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row gap-6">
                      {/* Left Column - Basic Info */}
                      <div className="flex-1 space-y-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-white">Group: {registration.group_id}</h3>
                            <p className="text-gray-300">{registration.leader_name} (Leader)</p>
                            <p className="text-sm text-gray-400 mt-1">{registration.leader_email}</p>
                          </div>
                          <div className="flex gap-2">
                            {getStatusBadge(registration.status)}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex items-center gap-2 text-gray-300">
                            <Phone className="w-4 h-4" />
                            <span>{registration.leader_phone}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-300">
                            <Users className="w-4 h-4" />
                            <span>{registration.member_count} members</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-300">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(registration.created_at).toLocaleDateString()}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-300">
                            <MapPin className="w-4 h-4" />
                            <span>{registration.event_category}</span>
                          </div>
                        </div>

                        {/* Event Information */}
                        <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-600/20">
                          <h4 className="text-sm font-medium text-gray-200 mb-3">Event Information</h4>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                              <div>
                                <span className="text-white text-sm font-medium">Event: </span>
                                <span className="text-purple-400 text-sm font-bold">{registration.event_name}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                              <div>
                                <span className="text-white text-sm font-medium">Category: </span>
                                <span className="text-cyan-400 text-sm font-bold">{registration.event_category}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Right Column - Payment & Actions */}
                      <div className="lg:w-80 space-y-4">
                        {/* Payment Info */}
                        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-600/30">
                          <h4 className="text-sm font-medium text-gray-200 mb-3 flex items-center gap-2">
                            <CreditCard className="w-4 h-4" />
                            Payment Details
                          </h4>
                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-300 font-medium">Total Amount:</span>
                              <span className="text-green-400 font-medium text-lg">₹{registration.total_amount.toLocaleString()}</span>
                            </div>
                            
                            <div className="pt-2 border-t border-gray-600/30">
                              {registration.payment_transaction_id ? (
                                <div className="space-y-2">
                                  <div className="flex justify-between items-start">
                                    <span className="text-gray-300 text-sm">Transaction ID:</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-white font-mono text-xs text-right max-w-[120px] break-all">
                                        {registration.payment_transaction_id}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="p-1 h-6 w-6 text-gray-400 hover:text-white hover:bg-gray-700"
                                        onClick={() => {
                                          navigator.clipboard.writeText(registration.payment_transaction_id);
                                          toast({
                                            title: "Success",
                                            description: "Transaction ID copied!",
                                          });
                                        }}
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                  {registration.status !== 'pending' && (
                                    <div className="text-xs text-gray-400">
                                      Status: {registration.status === 'approved' && (
                                        <span className="text-green-400 font-semibold">Approved</span>
                                      )}
                                      {registration.status === 'rejected' && (
                                        <span className="text-red-400 font-semibold">Rejected</span>
                                      )}
                                      <br />
                                      Reviewed: {registration.reviewed_at 
                                        ? new Date(registration.reviewed_at).toLocaleDateString()
                                        : 'Not reviewed'
                                      }
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                                  <span className="text-red-400 text-sm">No Payment Information</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="space-y-3">
                          {/* View Details Button */}
                          <Button
                            variant="outline"
                            className="border-blue-500/50 text-black hover:bg-blue-600/20 hover:border-blue-400 w-full hover:text-white"
                            onClick={() => handleViewDetails(registration.group_id)}
                            disabled={processingId === registration.group_id}
                          >
                            {processingId === registration.group_id ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                              <Eye className="w-4 h-4 mr-2" />
                            )}
                            View Details
                          </Button>

                          {/* View Payment Proof Button */}
                          <Button
                            variant="outline"
                            className="border-purple-500/50 text-black-400 hover:bg-purple-600/20 hover:border-purple-400 w-full hover:text-white"
                            onClick={() => handleShowPaymentProof(registration.payment_screenshot_path!)}
                            disabled={!registration.payment_screenshot_path}
                          >
                            <ImageIcon className="w-4 h-4 mr-2" />
                            {registration.payment_screenshot_path ? 'View Payment Proof' : 'No Payment Proof Available'}
                          </Button>
                          
                          {/* Approve/Reject Buttons - Only for pending registrations */}
                          {registration.status === 'pending' && (
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                variant="outline"
                                className="bg-green-600 border-green-500/50 text-white hover:bg-green-600/20 hover:border-green-400 hover:text-white"
                                onClick={() => handleApprove(registration.group_id)}
                                disabled={processingId === registration.group_id}
                              >
                                {processingId === registration.group_id ? (
                                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                )}
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                className="bg-red-600 border-red-500/50 text-white hover:bg-red-600/20 hover:border-red-400 hover:text-white"
                                onClick={() => {
                                  setSelectedRegistration({ ...registration, members: [] } as any);
                                  setShowRejectDialog(true);
                                }}
                                disabled={processingId === registration.group_id}
                              >
                                {processingId === registration.group_id ? (
                                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                  <XCircle className="w-4 h-4 mr-2" />
                                )}
                                Reject
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Registration Details Dialog */}
      <Dialog open={showRegistrationDetails} onOpenChange={setShowRegistrationDetails}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Registration Details</DialogTitle>
          </DialogHeader>
          
          {selectedRegistration && (
            <div className="space-y-6">
              {/* Registration Information */}
              <Card className="bg-slate-700/50 border-slate-600">
                <CardHeader>
                  <CardTitle className="text-lg text-white">Registration Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Group ID:</span>
                      <p className="text-white font-semibold">{selectedRegistration.group_id}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Registration Date:</span>
                      <p className="text-white">{new Date(selectedRegistration.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Status:</span>
                      <p className={`font-semibold ${
                        selectedRegistration.status === 'approved' ? 'text-green-400' :
                        selectedRegistration.status === 'rejected' ? 'text-red-400' : 'text-yellow-400'
                      }`}>{selectedRegistration.status.charAt(0).toUpperCase() + selectedRegistration.status.slice(1)}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Member Count:</span>
                      <p className="text-white">{selectedRegistration.member_count}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Event Information */}
              <Card className="bg-slate-700/50 border-slate-600">
                <CardHeader>
                  <CardTitle className="text-lg text-white">Event Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Event Name:</span>
                      <p className="text-white font-semibold">{selectedRegistration.event_name}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Event Category:</span>
                      <p className="text-cyan-400">{selectedRegistration.event_category || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Price per Member:</span>
                      <p className="text-white">₹{selectedRegistration.event_price}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Total Amount:</span>
                      <p className="text-green-400 font-bold">₹{selectedRegistration.total_amount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Person Information */}
              <Card className="bg-slate-700/50 border-slate-600">
                <CardHeader>
                  <CardTitle className="text-lg text-white">Contact Person Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Contact Name:</span>
                      <p className="text-white font-semibold">{selectedRegistration.contact_name}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Email:</span>
                      <p className="text-white">{selectedRegistration.contact_email}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">Phone:</span>
                      <p className="text-white">{selectedRegistration.contact_phone}</p>
                    </div>
                    <div>
                      <span className="text-gray-400">User ID:</span>
                      <p className="text-white">{selectedRegistration.contact_user_id}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Group Members */}
              <Card className="bg-slate-700/50 border-slate-600">
                <CardHeader>
                  <CardTitle className="text-lg text-white">Group Members ({selectedRegistration.member_count})</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedRegistration.members && selectedRegistration.members.length > 0 ? (
                    <div className="space-y-3">
                      {selectedRegistration.members.map((member, index) => (
                        <div key={member.id || index} className="p-3 bg-slate-600/50 rounded-lg">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm">
                            <div>
                              <span className="text-gray-400">Name:</span>
                              <p className="text-white font-semibold">{member.name}</p>
                            </div>
                            <div>
                              <span className="text-gray-400">User ID:</span>
                              <p className="text-white font-semibold">{member.user_id}</p>
                            </div>
                            <div>
                              <span className="text-gray-400">Phone:</span>
                              <p className="text-cyan-400 font-semibold">{member.phone}</p>
                            </div>
                            <div>
                              <span className="text-gray-400">College:</span>
                              <p className="text-purple-400 font-semibold">{member.college}</p>
                            </div>
                          </div>
                          <div className="mt-2 text-xs">
                            <div>
                              <span className="text-gray-400">Email: </span>
                              <span className="text-blue-400">{member.email}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-400">No member details available</p>
                      <p className="text-xs text-gray-500 mt-2">Member data may not be available for this registration</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Payment Information */}
              <Card className="bg-slate-700/50 border-slate-600">
                <CardHeader>
                  <CardTitle className="text-lg text-white">Payment Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Transaction ID:</span>
                        <p className="text-white font-mono">{selectedRegistration.payment_transaction_id}</p>
                      </div>
                      <div>
                        <span className="text-gray-400">Amount:</span>
                        <p className="text-green-400 font-bold">₹{selectedRegistration.total_amount.toLocaleString()}</p>
                      </div>
                    </div>
                    
                    {selectedRegistration.payment_screenshot_path && (
                      <div>
                        <span className="text-gray-400 block mb-2">Payment Screenshot:</span>
                        <Button
                          onClick={() => handleShowPaymentProof(selectedRegistration.payment_screenshot_path!)}
                          variant="outline"
                          className="border-blue-500 text-blue-400 hover:bg-blue-500 hover:text-white"
                        >
                          <ImageIcon className="w-4 h-4 mr-2" />
                          View Payment Proof
                        </Button>
                      </div>
                    )}
                    
                    {selectedRegistration.status !== 'pending' && (
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Reviewed By:</span>
                          <p className="text-white">{selectedRegistration.reviewed_by || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-gray-400">Reviewed At:</span>
                          <p className="text-white">
                            {selectedRegistration.reviewed_at 
                              ? new Date(selectedRegistration.reviewed_at).toLocaleString()
                              : 'N/A'
                            }
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {selectedRegistration.rejection_reason && (
                      <div>
                        <span className="text-gray-400 block mb-2">Rejection Reason:</span>
                        <p className="text-red-400 bg-red-900/20 p-3 rounded-lg border border-red-500/20">
                          {selectedRegistration.rejection_reason}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Registration Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Reject Registration</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">
                Reason for rejection *
              </label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Please provide a detailed reason for rejecting this registration..."
                className="bg-slate-700 border-slate-600 text-white placeholder-gray-400"
                rows={4}
              />
            </div>
            
            <div className="flex justify-end gap-3">
              <Button
                onClick={() => {
                  setShowRejectDialog(false);
                  setRejectionReason('');
                }}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleReject}
                disabled={!rejectionReason.trim() || !!processingId}
                className="bg-red-600 hover:bg-red-700"
              >
                {processingId ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  'Reject Registration'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Proof Dialog */}
      <Dialog open={showPaymentProof} onOpenChange={setShowPaymentProof}>
        <DialogContent className="max-w-2xl bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Payment Proof</DialogTitle>
          </DialogHeader>
          
          <div className="text-center">
            {paymentProofUrl ? (
              <Image
                src={paymentProofUrl}
                alt="Payment Proof"
                width={600}
                height={400}
                className="rounded-lg mx-auto"
                style={{ maxHeight: '500px', objectFit: 'contain' }}
              />
            ) : (
              <div className="p-8">
                <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-4" />
                <p className="text-gray-400">Loading payment proof...</p>
              </div>
            )}
          </div>
          
          <div className="flex justify-center gap-3">
            <Button
              onClick={() => setShowPaymentProof(false)}
              variant="outline"
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Close
            </Button>
            {paymentProofUrl && (
              <Button
                onClick={() => window.open(paymentProofUrl, '_blank')}
                className="bg-purple-600 hover:bg-purple-700"
              >
                Open in New Tab
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
