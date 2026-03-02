import React, { useState, useEffect, useRef } from 'react';
import { Plus, User, DollarSign, Bell, TrendingUp, TrendingDown, Calendar, Edit2, Check, X, UserPlus, ArrowRight, Users, Trash2, LogOut, Search, Camera, Upload, AlertCircle, History as HistoryIcon, Send, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// ============================================
// REPLACE THESE WITH YOUR ACTUAL SUPABASE CREDENTIALS
// ============================================
const supabaseUrl = 'https://lntmwatlmhcpfkicghcq.supabase.co';
const supabaseAnonKey = 'sb_publishable_FVsvmDna-hn8hRcZbUG4vw_Rm01vClS';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function TabsApp() {
  const [session, setSession] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [friends, setFriends] = useState([]);
  const [pendingFriends, setPendingFriends] = useState([]);
  const [tabs, setTabs] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupExpenses, setGroupExpenses] = useState([]);
  const [notifications, setNotifications] = useState([]);
  
  const [view, setView] = useState('home');
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [error, setError] = useState('');
  const [expandedSettledTabs, setExpandedSettledTabs] = useState({});
  
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleModalData, setSettleModalData] = useState(null);
  const [showReminderToast, setShowReminderToast] = useState(false);
  const [reminderCooldown, setReminderCooldown] = useState({});
  
  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    name: '',
    mode: 'login',
    showPassword: false,
    rememberMe: false
  });
  
  const [tabForm, setTabForm] = useState({
    amount: '',
    description: '',
    type: 'owe',
    friendId: null,
    date: new Date().toISOString().split('T')[0]
  });
  
  const [groupForm, setGroupForm] = useState({
    name: '',
    selectedFriends: []
  });
  
  const [groupExpenseForm, setGroupExpenseForm] = useState({
    amount: '',
    description: '',
    paidBy: null,
    splitWith: [],
    date: new Date().toISOString().split('T')[0]
  });
  
  const [profilePictureFile, setProfilePictureFile] = useState(null);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadUserData(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        loadUserData(session.user.id);
      } else {
        setCurrentUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      loadNotifications(currentUser.id);
    }, 30000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const loadUserData = async (userId) => {
    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (userError) throw userError;
      setCurrentUser(userData);
      setNewName(userData.name);

      await Promise.all([
        loadFriends(userId),
        loadPendingFriends(userId),
        loadTabs(userId),
        loadGroups(userId),
        loadGroupExpenses(userId),
        loadNotifications(userId)
      ]);
    } catch (err) {
      console.error('Error loading user data:', err);
      setError('Failed to load your data');
    }
  };

  const loadFriends = async (userId) => {
    const { data, error } = await supabase
      .from('friendships')
      .select('friend:users!friendships_friend_user_id_fkey(id, username, name, profile_picture_url)')
      .eq('user_id', userId)
      .eq('status', 'accepted');
    
    if (!error && data) {
      setFriends(data.map(f => f.friend));
    }
  };

  const loadPendingFriends = async (userId) => {
    const { data: outgoing, error: outError } = await supabase
      .from('friendships')
      .select('friend:users!friendships_friend_user_id_fkey(id, username, name, profile_picture_url), status')
      .eq('user_id', userId)
      .eq('status', 'pending');
    
    const { data: incoming, error: inError } = await supabase
      .from('friendships')
      .select('requester:users!friendships_user_id_fkey(id, username, name, profile_picture_url), status')
      .eq('friend_user_id', userId)
      .eq('status', 'pending');
    
    if (!outError && outgoing) {
      setPendingFriends(prev => ({
        ...prev,
        outgoing: outgoing.map(f => ({ ...f.friend, direction: 'outgoing' }))
      }));
    }
    
    if (!inError && incoming) {
      setPendingFriends(prev => ({
        ...prev,
        incoming: incoming.map(f => ({ ...f.requester, direction: 'incoming' }))
      }));
    }
  };

  const loadTabs = async (userId) => {
    const { data, error } = await supabase
      .from('tabs')
      .select('*')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`);
    
    if (!error && data) {
      setTabs(data);
    }
  };

  const loadGroups = async (userId) => {
    const { data, error } = await supabase
      .from('group_members')
      .select('group:groups(*)')
      .eq('user_id', userId);
    
    if (!error && data) {
      setGroups(data.map(gm => gm.group));
    }
  };

  const loadGroupExpenses = async (userId) => {
    const { data: userGroups } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId);
    
    if (!userGroups || userGroups.length === 0) {
      setGroupExpenses([]);
      return;
    }
    
    const groupIds = userGroups.map(g => g.group_id);
    
    const { data, error } = await supabase
      .from('group_expenses')
      .select('*, splits:group_expense_splits(*)')
      .in('group_id', groupIds);
    
    if (!error && data) {
      setGroupExpenses(data);
    }
  };

  const loadNotifications = async (userId) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (!error && data) {
      setNotifications(data);
      if (data.length > 0 && Notification.permission === 'granted') {
        const latest = data[0];
        new Notification(latest.title, {
          body: latest.message
        });
      }
    }
  };

  const markNotificationRead = async (notificationId) => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);
    await loadNotifications(currentUser.id);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    
    if (authForm.password !== authForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (authForm.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    try {
      const { data: existingUser } = await supabase
        .from('users')
        .select('username')
        .ilike('username', authForm.username)
        .single();
      
      if (existingUser) {
        setError('Username already taken');
        return;
      }
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: authForm.email,
        password: authForm.password,
        options: {
          data: {
            username: authForm.username,
            name: authForm.name
          }
        }
      });
      
      if (authError) throw authError;
      alert('Account created! You can now log in.');
      setAuthForm({ ...authForm, mode: 'login' });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: authForm.email,
        password: authForm.password,
      });
      if (error) throw error;
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const searchUsers = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    const { data, error } = await supabase
      .from('users')
      .select('id, username, name, profile_picture_url')
      .ilike('username', `%${query}%`)
      .neq('id', currentUser.id)
      .limit(10);
    if (!error && data) {
      const friendIds = friends.map(f => f.id);
      const pendingIds = [
        ...(pendingFriends.outgoing || []).map(f => f.id),
        ...(pendingFriends.incoming || []).map(f => f.id)
      ];
      const filtered = data.filter(u => !friendIds.includes(u.id) && !pendingIds.includes(u.id));
      setSearchResults(filtered);
    }
  };

  const sendFriendRequest = async (friendUserId) => {
    try {
      await supabase.from('friendships').insert([
        { user_id: currentUser.id, friend_user_id: friendUserId, status: 'pending' }
      ]);
      
      await supabase.from('notifications').insert([{
        user_id: friendUserId,
        type: 'friend_request',
        title: 'New Friend Request',
        message: `${currentUser.username} sent you a friend request`,
        metadata: { from_user_id: currentUser.id }
      }]);
      
      await loadPendingFriends(currentUser.id);
      setUserSearchQuery('');
      setSearchResults([]);
      alert('Friend request sent!');
    } catch (err) {
      setError(err.message);
    }
  };

  const acceptFriendRequest = async (friendId) => {
    try {
      await supabase.from('friendships')
        .update({ status: 'accepted' })
        .eq('user_id', friendId)
        .eq('friend_user_id', currentUser.id);
      
      await supabase.from('friendships').insert([
        { user_id: currentUser.id, friend_user_id: friendId, status: 'accepted' }
      ]);
      
      await loadFriends(currentUser.id);
      await loadPendingFriends(currentUser.id);
      alert('Friend request accepted!');
    } catch (err) {
      setError(err.message);
    }
  };

  const rejectFriendRequest = async (friendId) => {
    try {
      await supabase.from('friendships')
        .delete()
        .eq('user_id', friendId)
        .eq('friend_user_id', currentUser.id);
      
      await loadPendingFriends(currentUser.id);
    } catch (err) {
      setError(err.message);
    }
  };
const deleteFriend = async (friendId) => {
    if (!confirm('Remove this friend? All tabs will be deleted.')) return;
    try {
      await supabase.from('friendships').delete()
        .or(`and(user_id.eq.${currentUser.id},friend_user_id.eq.${friendId}),and(user_id.eq.${friendId},friend_user_id.eq.${currentUser.id})`);
      await supabase.from('tabs').delete()
        .or(`and(from_user_id.eq.${currentUser.id},to_user_id.eq.${friendId}),and(from_user_id.eq.${friendId},to_user_id.eq.${currentUser.id})`);
      await loadFriends(currentUser.id);
      await loadTabs(currentUser.id);
      setView('friends');
    } catch (err) {
      setError(err.message);
    }
  };

  const addTab = async () => {
    if (!tabForm.amount || !tabForm.friendId) {
      setError('Please fill in all fields');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('tabs')
        .insert([{
          from_user_id: tabForm.type === 'owe' ? currentUser.id : tabForm.friendId,
          to_user_id: tabForm.type === 'owe' ? tabForm.friendId : currentUser.id,
          amount: parseFloat(tabForm.amount),
          description: tabForm.description,
          date: tabForm.date,
          status: 'active'
        }]);
      
      if (error) throw error;
      await loadTabs(currentUser.id);
      setTabForm({
        amount: '',
        description: '',
        type: 'owe',
        friendId: null,
        date: new Date().toISOString().split('T')[0]
      });
      setView('home');
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteTab = async (tabId) => {
    if (!confirm('Delete this tab?')) return;
    try {
      await supabase.from('tabs').delete().eq('id', tabId);
      await loadTabs(currentUser.id);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSettleClick = async (friend) => {
    const balance = calculateNetBalance(friend.id);
    const unsettledTabs = getFriendTabs(friend.id, false);
    
    setSettleModalData({
      friend,
      balance,
      tabCount: unsettledTabs.length,
      isOwed: balance > 0,
      tabs: unsettledTabs
    });
    setShowSettleModal(true);
  };

  const confirmSettle = async () => {
    const { friend, isOwed, tabs: friendTabs } = settleModalData;
    
    try {
      if (isOwed) {
        for (const tab of friendTabs) {
          if (!tab.isGroupExpense) {
            await supabase.from('tabs').update({ 
              status: 'settled',
              settled_at: new Date().toISOString()
            }).eq('id', tab.id);
          }
        }
        await supabase.from('notifications').insert([{
          user_id: friend.id,
          type: 'settlement_cleared',
          title: 'Tab Settled',
          message: `${currentUser.username} cleared your debt. All tabs are settled!`,
          metadata: { friend_id: currentUser.id }
        }]);
        alert(`All tabs with ${friend.username} have been settled!`);
      } else {
        for (const tab of friendTabs) {
          if (!tab.isGroupExpense) {
            await supabase.from('tabs').update({ 
              status: 'pending_settlement',
              settlement_requested_at: new Date().toISOString()
            }).eq('id', tab.id);
          }
        }
        alert(`Settlement request sent to ${friend.username}!`);
      }
      await loadTabs(currentUser.id);
      setShowSettleModal(false);
      setSettleModalData(null);
    } catch (err) {
      setError('Failed to settle tabs');
    }
  };

  const approveSettlement = async (friendId) => {
    try {
      const pendingTabs = tabs.filter(t => 
        t.status === 'pending_settlement' &&
        ((t.from_user_id === friendId && t.to_user_id === currentUser.id))
      );
      
      for (const tab of pendingTabs) {
        await supabase.from('tabs').update({ 
          status: 'settled',
          settled_at: new Date().toISOString()
        }).eq('id', tab.id);
      }
      await loadTabs(currentUser.id);
      alert('Settlement approved!');
    } catch (err) {
      setError('Failed to approve settlement');
    }
  };

  const denySettlement = async (friendId) => {
    try {
      const pendingTabs = tabs.filter(t => 
        t.status === 'pending_settlement' &&
        ((t.from_user_id === friendId && t.to_user_id === currentUser.id))
      );
      
      for (const tab of pendingTabs) {
        await supabase.from('tabs').update({ 
          status: 'active',
          settlement_requested_at: null
        }).eq('id', tab.id);
      }
      await loadTabs(currentUser.id);
      alert('Settlement denied');
    } catch (err) {
      setError('Failed to deny settlement');
    }
  };

  const canSendReminder = (friendId) => {
    const lastSent = reminderCooldown[friendId];
    if (!lastSent) return true;
    const hoursSince = (Date.now() - lastSent) / (1000 * 60 * 60);
    return hoursSince >= 12;
  };

  const sendReminder = async (friend) => {
    if (!canSendReminder(friend.id)) {
      const lastSent = reminderCooldown[friend.id];
      const hoursSince = (Date.now() - lastSent) / (1000 * 60 * 60);
      const hoursLeft = Math.ceil(12 - hoursSince);
      alert(`You can send another reminder in ${hoursLeft} hours`);
      return;
    }
    
    try {
      await supabase.from('reminder_history').insert([{
        from_user_id: currentUser.id,
        to_user_id: friend.id
      }]);
      await supabase.from('notifications').insert([{
        user_id: friend.id,
        type: 'settle_reminder',
        title: 'Settle Up Reminder',
        message: `${currentUser.username} wants you to settle up your tab`,
        metadata: { friend_id: currentUser.id }
      }]);
      setReminderCooldown({ ...reminderCooldown, [friend.id]: Date.now() });
      setShowReminderToast(true);
      setTimeout(() => setShowReminderToast(false), 3000);
    } catch (err) {
      setError('Failed to send reminder');
    }
  };

  const updateName = async () => {
    if (!newName.trim()) return;
    try {
      const { error } = await supabase
        .from('users')
        .update({ name: newName })
        .eq('id', currentUser.id);
      if (error) throw error;
      setCurrentUser({ ...currentUser, name: newName });
      setEditingName(false);
    } catch (err) {
      setError('Failed to update name');
    }
  };

  const uploadProfilePicture = async (file) => {
    if (!file || !currentUser) return;
    setUploadingPicture(true);
    setError('');
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUser.id}/profile.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(fileName, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      const { data } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(fileName);
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ profile_picture_url: data.publicUrl })
        .eq('id', currentUser.id);
      
      if (updateError) throw updateError;
      await loadUserData(currentUser.id);
      setProfilePictureFile(null);
    } catch (err) {
      setError('Failed to upload profile picture');
    } finally {
      setUploadingPicture(false);
    }
  };

  const calculateNetBalance = (friendId) => {
    if (!currentUser) return 0;
    
    const relevantTabs = tabs.filter(t => 
      t.status === 'active' && (
        (t.from_user_id === currentUser.id && t.to_user_id === friendId) ||
        (t.from_user_id === friendId && t.to_user_id === currentUser.id)
      )
    );
    
    const iOwe = relevantTabs.filter(t => t.from_user_id === currentUser.id)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const theyOwe = relevantTabs.filter(t => t.from_user_id === friendId)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    return theyOwe - iOwe;
  };

  const getAllBalances = () => {
    if (!currentUser) return [];
    return friends.map(friend => ({
      friend,
      balance: calculateNetBalance(friend.id)
    })).filter(b => Math.abs(b.balance) > 0.01);
  };

  const getFriendTabs = (friendId, includeSettled = false) => {
    const regularTabs = tabs.filter(t => {
      const isBetweenUsers = (t.from_user_id === currentUser.id && t.to_user_id === friendId) ||
                             (t.from_user_id === friendId && t.to_user_id === currentUser.id);
      return isBetweenUsers && (includeSettled || t.status !== 'settled');
    }).map(t => ({
      ...t,
      type: t.from_user_id === currentUser.id ? 'owe' : 'owed',
      amount: parseFloat(t.amount).toFixed(2)
    }));
    return regularTabs.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const getMyActiveTabs = () => {
    if (!currentUser) return {};
    
    const activeTabs = tabs.filter(t => t.status === 'active');
    const grouped = {};
    
    friends.forEach(friend => {
      const friendTabs = activeTabs.filter(t =>
        (t.from_user_id === currentUser.id && t.to_user_id === friend.id) ||
        (t.from_user_id === friend.id && t.to_user_id === currentUser.id)
      );
      
      if (friendTabs.length > 0) {
        const balance = calculateNetBalance(friend.id);
        grouped[friend.id] = {
          friend,
          tabs: friendTabs.map(t => ({
            ...t,
            type: t.from_user_id === currentUser.id ? 'owe' : 'owed',
            amount: parseFloat(t.amount).toFixed(2)
          })).sort((a, b) => new Date(b.date) - new Date(a.date)),
          balance
        };
      }
    });
    
    return grouped;
  };

  const getSettledTabs = () => {
    if (!currentUser) return {};
    const settled = tabs.filter(t => t.status === 'settled');
    const grouped = {};
    
    friends.forEach(friend => {
      const friendSettled = settled.filter(t =>
        (t.from_user_id === currentUser.id && t.to_user_id === friend.id) ||
        (t.from_user_id === friend.id && t.to_user_id === currentUser.id)
      );
      
      if (friendSettled.length > 0) {
        grouped[friend.id] = {
          friend,
          tabs: friendSettled.map(t => ({
            ...t,
            type: t.from_user_id === currentUser.id ? 'owe' : 'owed',
            amount: parseFloat(t.amount).toFixed(2)
          })).sort((a, b) => new Date(b.settled_at) - new Date(a.settled_at))
        };
      }
    });
    return grouped;
  };

  const toggleSettledExpansion = (friendId) => {
    setExpandedSettledTabs(prev => ({
      ...prev,
      [friendId]: !prev[friendId]
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-4 rounded-2xl inline-block mb-4 animate-pulse">
            <DollarSign className="w-12 h-12" />
          </div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }
{view === 'addTab' && (
          <div className="space-y-6">
            <button onClick={() => setView('home')} className="text-gray-400 hover:text-white flex items-center gap-2">← Back</button>
            <div className="glassmorphism rounded-2xl p-6 border">
              <h2 className="text-2xl font-bold mb-6">New Tab</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Friend</label>
                  <select value={tabForm.friendId || ''} onChange={(e) => setTabForm({ ...tabForm, friendId: e.target.value })}
                    className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white">
                    <option value="">Select a friend</option>
                    {friends.map(friend => (
                      <option key={friend.id} value={friend.id}>{friend.name} (@{friend.username})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Amount</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xl">$</span>
                    <input type="number" step="0.01" value={tabForm.amount} onChange={(e) => setTabForm({ ...tabForm, amount: e.target.value })}
                      placeholder="0.00" className="w-full bg-slate-800/50 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-white text-xl font-mono" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => setTabForm({ ...tabForm, type: 'owe' })}
                      className={`py-3 rounded-xl font-semibold transition-all border ${tabForm.type === 'owe' ? 'bg-red-500/20 border-red-500/50 text-red-400' : 'bg-slate-800/30 border-white/10 text-gray-400'}`}>
                      I owe them
                    </button>
                    <button onClick={() => setTabForm({ ...tabForm, type: 'owed' })}
                      className={`py-3 rounded-xl font-semibold transition-all border ${tabForm.type === 'owed' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-slate-800/30 border-white/10 text-gray-400'}`}>
                      They owe me
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Description</label>
                  <input type="text" value={tabForm.description} onChange={(e) => setTabForm({ ...tabForm, description: e.target.value })}
                    placeholder="What's this for?" className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Date</label>
                  <input type="date" value={tabForm.date} onChange={(e) => setTabForm({ ...tabForm, date: e.target.value })}
                    className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white" />
                </div>
                <button onClick={addTab} disabled={!tabForm.amount || !tabForm.friendId}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl mt-6">
                  Create Tab
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'history' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Settled Tabs History</h2>
            {Object.keys(getSettledTabs()).length === 0 ? (
              <div className="glassmorphism rounded-2xl p-8 text-center border">
                <HistoryIcon className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p className="text-gray-400">No settled tabs yet</p>
              </div>
            ) : (
              Object.values(getSettledTabs()).map(({ friend, tabs: settledTabs }) => (
                <div key={friend.id} className="glassmorphism rounded-2xl p-6 border">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-slate-700/50 p-3 rounded-full">
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">{friend.name}</h3>
                      <p className="text-sm text-gray-400">@{friend.username} • {settledTabs.length} settled</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {settledTabs.map(tab => (
                      <div key={tab.id} className="bg-slate-800/30 rounded-lg p-3 border border-white/10 opacity-60">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">{tab.description || 'No description'}</p>
                            <p className="text-xs text-gray-500">Settled {new Date(tab.settled_at).toLocaleDateString()}</p>
                          </div>
                          <p className={`font-mono font-bold ${tab.type === 'owed' ? 'text-emerald-400' : 'text-red-400'}`}>
                            ${tab.amount}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {view === 'profile' && (
          <div className="space-y-6">
            <div className="glassmorphism rounded-2xl p-6 border">
              <h2 className="text-2xl font-bold mb-6">Profile Settings</h2>
              <div className="space-y-6">
                <div className="flex flex-col items-center">
                  <div className="w-32 h-32 rounded-full bg-slate-700 flex items-center justify-center mb-4">
                    <User className="w-16 h-16 text-gray-400" />
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => e.target.files[0] && setProfilePictureFile(e.target.files[0])} className="hidden" />
                  {profilePictureFile ? (
                    <div className="flex gap-2">
                      <button onClick={() => uploadProfilePicture(profilePictureFile)} disabled={uploadingPicture}
                        className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        {uploadingPicture ? 'Uploading...' : 'Upload'}
                      </button>
                      <button onClick={() => setProfilePictureFile(null)} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => fileInputRef.current?.click()}
                      className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                      <Camera className="w-4 h-4" />
                      Change Picture
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Name (Display Name)</label>
                  {editingName ? (
                    <div className="flex gap-2">
                      <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                        className="flex-1 bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white" />
                      <button onClick={updateName} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl">
                        <Check className="w-5 h-5" />
                      </button>
                      <button onClick={() => { setEditingName(false); setNewName(currentUser.name); }}
                        className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input type="text" value={currentUser.name} disabled className="flex-1 bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-gray-500" />
                      <button onClick={() => setEditingName(true)} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl">
                        <Edit2 className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">This is your display name (editable)</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Username</label>
                  <input type="text" value={currentUser.username} disabled className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-gray-500" />
                  <p className="text-xs text-gray-500 mt-1">Your unique @username (cannot be changed)</p>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Email</label>
                  <input type="email" value={currentUser.email} disabled className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-gray-500" />
                </div>
              </div>
            </div>
          </div>
        )}

        {showSettleModal && settleModalData && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glassmorphism rounded-2xl p-6 max-w-md w-full border">
              <h2 className="text-2xl font-bold mb-4">Settle All Tabs</h2>
              <div className="bg-slate-800/50 rounded-lg p-4 mb-6 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400">Friend:</span>
                  <span className="font-semibold">{settleModalData.friend.name}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400">Total Tabs:</span>
                  <span className="font-semibold">{settleModalData.tabCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Net Amount:</span>
                  <span className={`text-2xl font-bold font-mono ${settleModalData.isOwed ? 'text-emerald-400' : 'text-red-400'}`}>
                    ${Math.abs(settleModalData.balance).toFixed(2)}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  {settleModalData.isOwed ? 'They owe you' : 'You owe them'}
                </p>
              </div>
              {settleModalData.isOwed ? (
                <div className="space-y-3">
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-sm">
                    <AlertCircle className="inline w-4 h-4 mr-2 text-emerald-400" />
                    You're clearing their debt. This will settle all tabs and notify them.
                  </div>
                  <button onClick={confirmSettle}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-xl">
                    Confirm Settlement
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm">
                    <AlertCircle className="inline w-4 h-4 mr-2 text-yellow-400" />
                    Settlement request will be sent to {settleModalData.friend.name} for approval.
                  </div>
                  <button onClick={confirmSettle}
                    className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-3 rounded-xl">
                    Send Settlement Request
                  </button>
                </div>
              )}
              <button onClick={() => { setShowSettleModal(false); setSettleModalData(null); }}
                className="w-full mt-3 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-xl">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
