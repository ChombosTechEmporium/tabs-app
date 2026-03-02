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
  // Auth & user state
  const [session, setSession] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // App data state
  const [friends, setFriends] = useState([]);
  const [tabs, setTabs] = useState([]);
  const [groups, setGroups] = useState([]);
  const [groupExpenses, setGroupExpenses] = useState([]);
  const [notifications, setNotifications] = useState([]);
  
  // View state
  const [view, setView] = useState('home');
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [error, setError] = useState('');
  
  // Modal state
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleModalData, setSettleModalData] = useState(null);
  const [showReminderToast, setShowReminderToast] = useState(false);
  const [reminderCooldown, setReminderCooldown] = useState({});
  
  // Form states
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
  
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchTimeout, setSearchTimeout] = useState(null);
  
  const [tabForm, setTabForm] = useState({
    amount: '',
    description: '',
    type: 'owe',
    friendId: null,
    friendUsername: '',
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
      alert('Account created! Please check your email to verify.');
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
      .limit(5);
    if (!error && data) {
      setSearchResults(data);
    }
  };

  const handleFriendSearch = (query) => {
    setFriendSearchQuery(query);
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    const timeout = setTimeout(() => {
      searchUsers(query);
    }, 1000);
    setSearchTimeout(timeout);
  };

  const addFriend = async (friendUserId) => {
    try {
      const { data: existing } = await supabase
        .from('friendships')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('friend_user_id', friendUserId)
        .single();
      
      if (existing) {
        setError('Already friends');
        return;
      }
      
      await supabase.from('friendships').insert([
        { user_id: currentUser.id, friend_user_id: friendUserId, status: 'accepted' },
        { user_id: friendUserId, friend_user_id: currentUser.id, status: 'accepted' }
      ]);
      await loadFriends(currentUser.id);
      setFriendSearchQuery('');
      setSearchResults([]);
      setView('home');
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
      setView('home');
    } catch (err) {
      setError(err.message);
    }
  };
const searchUserForTab = async (query) => {
    if (!query.trim()) return;
    
    const friendMatch = friends.find(f => 
      f.username.toLowerCase().startsWith(query.toLowerCase())
    );
    
    if (friendMatch) {
      setTabForm({ ...tabForm, friendId: friendMatch.id, friendUsername: friendMatch.username });
      return;
    }
    
    const { data } = await supabase
      .from('users')
      .select('id, username, name, profile_picture_url')
      .ilike('username', query)
      .neq('id', currentUser.id)
      .single();
    
    if (data) {
      setTabForm({ ...tabForm, friendId: data.id, friendUsername: data.username });
    } else {
      setError('Not a valid username');
      setTabForm({ ...tabForm, friendId: null, friendUsername: '' });
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
        friendUsername: '',
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
      console.error(err);
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

  const addGroup = async () => {
    if (!groupForm.name.trim() || groupForm.selectedFriends.length < 1) {
      setError('Please enter a group name and select at least 1 friend');
      return;
    }
    
    try {
      const { data: newGroup, error: groupError } = await supabase
        .from('groups')
        .insert([{ name: groupForm.name, created_by_user_id: currentUser.id }])
        .select()
        .single();
      
      if (groupError) throw groupError;
      
      const members = [currentUser.id, ...groupForm.selectedFriends].map(userId => ({
        group_id: newGroup.id,
        user_id: userId
      }));
      await supabase.from('group_members').insert(members);
      await loadGroups(currentUser.id);
      setGroupForm({ name: '', selectedFriends: [] });
      setView('groups');
    } catch (err) {
      setError(err.message);
    }
  };

  const addGroupExpense = async () => {
    if (!groupExpenseForm.amount || !groupExpenseForm.paidBy || groupExpenseForm.splitWith.length === 0) {
      setError('Please fill in all fields');
      return;
    }
    
    try {
      const { data: newExpense, error: expenseError } = await supabase
        .from('group_expenses')
        .insert([{
          group_id: selectedGroup.id,
          paid_by_user_id: groupExpenseForm.paidBy,
          amount: parseFloat(groupExpenseForm.amount),
          description: groupExpenseForm.description,
          date: groupExpenseForm.date
        }])
        .select()
        .single();
      
      if (expenseError) throw expenseError;
      
      const perPerson = parseFloat(groupExpenseForm.amount) / groupExpenseForm.splitWith.length;
      const splits = groupExpenseForm.splitWith.map(userId => ({
        expense_id: newExpense.id,
        user_id: userId,
        amount: perPerson,
        status: 'active'
      }));
      await supabase.from('group_expense_splits').insert(splits);
      await loadGroupExpenses(currentUser.id);
      setGroupExpenseForm({
        amount: '',
        description: '',
        paidBy: null,
        splitWith: [],
        date: new Date().toISOString().split('T')[0]
      });
      setView('groupDetail');
    } catch (err) {
      setError(err.message);
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
    
    let groupBalance = 0;
    groupExpenses.forEach(expense => {
      const splits = expense.splits || [];
      const myOwedSplits = splits.filter(s => s.user_id === currentUser.id && s.status === 'active');
      const friendOwedSplits = splits.filter(s => s.user_id === friendId && s.status === 'active');
      
      if (expense.paid_by_user_id === currentUser.id && friendOwedSplits.length > 0) {
        groupBalance += friendOwedSplits.reduce((sum, s) => sum + parseFloat(s.amount), 0);
      }
      if (expense.paid_by_user_id === friendId && myOwedSplits.length > 0) {
        groupBalance -= myOwedSplits.reduce((sum, s) => sum + parseFloat(s.amount), 0);
      }
    });
    
    return (theyOwe - iOwe) + groupBalance;
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

  const toggleFriendInGroup = (friendId) => {
    setGroupForm(prev => ({
      ...prev,
      selectedFriends: prev.selectedFriends.includes(friendId)
        ? prev.selectedFriends.filter(id => id !== friendId)
        : [...prev.selectedFriends, friendId]
    }));
  };

  const toggleMemberInExpense = (memberId) => {
    setGroupExpenseForm(prev => ({
      ...prev,
      splitWith: prev.splitWith.includes(memberId)
        ? prev.splitWith.filter(id => id !== memberId)
        : [...prev.splitWith, memberId]
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
if (!session || !currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-center p-4">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@400;500;700&display=swap');
          * { font-family: 'DM Sans', sans-serif; }
          .glassmorphism {
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.1);
          }
        `}</style>

        <div className="max-w-md w-full glassmorphism rounded-2xl p-8 border">
          <div className="text-center mb-8">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-4 rounded-2xl inline-block mb-4">
              <DollarSign className="w-12 h-12" />
            </div>
            <h1 className="text-3xl font-bold mb-2">
              {authForm.mode === 'login' ? 'Welcome Back' : 'Create Account'}
            </h1>
            <p className="text-gray-400">
              {authForm.mode === 'login' ? 'Log in to Tabs' : 'Join Tabs today'}
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <form onSubmit={authForm.mode === 'login' ? handleLogin : handleSignup} className="space-y-4">
            {authForm.mode === 'signup' && (
              <>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Name</label>
                  <input
                    type="text"
                    value={authForm.name}
                    onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                    placeholder="John Smith"
                    className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500/50 outline-none"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Your display name (you can change this later)</p>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Username</label>
                  <input
                    type="text"
                    value={authForm.username}
                    onChange={(e) => setAuthForm({ ...authForm, username: e.target.value.toLowerCase() })}
                    placeholder="johnsmith"
                    className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500/50 outline-none"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Your unique @username (cannot be changed)</p>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-2">Email</label>
                  <input
                    type="email"
                    value={authForm.email}
                    onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                    placeholder="john@example.com"
                    className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500/50 outline-none"
                    required
                  />
                </div>
              </>
            )}

            {authForm.mode === 'login' && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Email</label>
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  placeholder="your email"
                  className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500/50 outline-none"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-gray-400 mb-2">Password</label>
              <div className="relative">
                <input
                  type={authForm.showPassword ? "text" : "password"}
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500/50 outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setAuthForm({ ...authForm, showPassword: !authForm.showPassword })}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {authForm.showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {authForm.mode === 'signup' && (
              <div>
                <label className="block text-sm text-gray-400 mb-2">Confirm Password</label>
                <input
                  type={authForm.showPassword ? "text" : "password"}
                  value={authForm.confirmPassword}
                  onChange={(e) => setAuthForm({ ...authForm, confirmPassword: e.target.value })}
                  placeholder="••••••••"
                  className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-emerald-500/50 outline-none"
                  required
                />
              </div>
            )}

            {authForm.mode === 'login' && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={authForm.rememberMe}
                  onChange={(e) => setAuthForm({ ...authForm, rememberMe: e.target.checked })}
                  className="w-4 h-4 rounded border-white/10 bg-slate-800/50 text-emerald-500 focus:ring-emerald-500"
                />
                <label htmlFor="rememberMe" className="ml-2 text-sm text-gray-400">
                  Remember me
                </label>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg"
            >
              {authForm.mode === 'login' ? 'Log In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setAuthForm({ ...authForm, mode: authForm.mode === 'login' ? 'signup' : 'login', error: '' })}
              className="text-emerald-400 hover:text-emerald-300 text-sm"
            >
              {authForm.mode === 'login' 
                ? "Don't have an account? Create account" 
                : 'Already have an account? Login'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@400;500;700&display=swap');
        * { font-family: 'DM Sans', sans-serif; }
        .font-mono { font-family: 'Space Mono', monospace; }
        .glassmorphism {
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .tab-card { transition: all 0.2s ease; }
        .tab-card:hover { transform: translateX(4px); border-color: rgba(16, 185, 129, 0.4); }
      `}</style>

      <div className="glassmorphism sticky top-0 z-40 border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-2 rounded-xl">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  Tabs
                </h1>
                <p className="text-xs text-gray-500">@{currentUser?.username}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNotificationPanel(!showNotificationPanel)}
                className="relative bg-slate-800/50 hover:bg-slate-700/50 p-2 rounded-lg transition-all border border-white/10"
              >
                <Bell className="w-5 h-5 text-gray-400" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </button>
              <button
                onClick={handleLogout}
                className="bg-slate-800/50 hover:bg-slate-700/50 p-2 rounded-lg transition-all border border-white/10"
              >
                <LogOut className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {showNotificationPanel && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowNotificationPanel(false)}>
          <div className="glassmorphism rounded-2xl p-6 max-w-md w-full border" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Notifications</h2>
              <button onClick={() => setShowNotificationPanel(false)}>
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            {notifications.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No new notifications</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {notifications.map(notif => (
                  <div key={notif.id} className="bg-slate-800/50 rounded-lg p-3 border border-white/10">
                    <div className="flex justify-between items-start mb-1">
                      <p className="font-semibold text-sm">{notif.title}</p>
                      <button onClick={() => markNotificationRead(notif.id)} className="text-emerald-400 hover:text-emerald-300">
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-gray-400 text-sm">{notif.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showReminderToast && (
        <div className="fixed bottom-4 right-4 bg-emerald-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50">
          <Check className="w-5 h-5" />
          <span>Reminder sent!</span>
        </div>
      )}

{view === 'home' && (
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
          <div className="flex gap-2">
            <button onClick={() => setView('home')} className="flex-1 py-3 px-4 rounded-lg font-semibold bg-emerald-500/20 border border-emerald-500/50 text-emerald-400">
              Friends
            </button>
            <button onClick={() => setView('settled')} className="flex-1 py-3 px-4 rounded-lg font-semibold bg-slate-800/30 border border-white/10 text-gray-400 hover:border-white/20">
              Settled Tabs
            </button>
            <button onClick={() => setView('profile')} className="flex-1 py-3 px-4 rounded-lg font-semibold bg-slate-800/30 border border-white/10 text-gray-400 hover:border-white/20">
              Profile
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="glassmorphism rounded-2xl p-4 border">
              <div className="flex items-center gap-2 text-emerald-400 mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-medium">You're owed</span>
              </div>
              <p className="text-3xl font-bold font-mono">
                ${getAllBalances().filter(b => b.balance > 0).reduce((sum, b) => sum + b.balance, 0).toFixed(2)}
              </p>
            </div>
            <div className="glassmorphism rounded-2xl p-4 border">
              <div className="flex items-center gap-2 text-red-400 mb-2">
                <TrendingDown className="w-4 h-4" />
                <span className="text-sm font-medium">You owe</span>
              </div>
              <p className="text-3xl font-bold font-mono">
                ${Math.abs(getAllBalances().filter(b => b.balance < 0).reduce((sum, b) => sum + b.balance, 0)).toFixed(2)}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-300">Friends</h2>
              <button onClick={() => setView('addFriend')} className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 px-4 py-2 rounded-lg flex items-center gap-2 transition-all border border-emerald-500/30">
                <UserPlus className="w-4 h-4" />
                Add Friend
              </button>
            </div>

            {friends.length === 0 ? (
              <div className="glassmorphism rounded-2xl p-8 text-center border">
                <User className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                <p className="text-gray-400">No friends added yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {friends.map(friend => {
                  const balance = calculateNetBalance(friend.id);
                  const isPositive = balance > 0;
                  const isNegative = balance < 0;
                  
                  return (
                    <div key={friend.id} onClick={() => { setSelectedFriend(friend); setView('friendDetail'); }}
                      className={`glassmorphism rounded-xl p-4 cursor-pointer transition-all border tab-card ${isPositive ? 'border-emerald-500/30' : isNegative ? 'border-red-500/30' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="bg-slate-700/50 p-3 rounded-full">
                            <User className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-semibold">{friend.name}</p>
                            <p className="text-sm text-gray-400">@{friend.username}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {Math.abs(balance) > 0.01 ? (
                            <>
                              <p className={`text-xl font-bold font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                ${Math.abs(balance).toFixed(2)}
                              </p>
                              <p className="text-xs text-gray-500">{isPositive ? 'owes you' : 'you owe'}</p>
                            </>
                          ) : (
                            <p className="text-gray-500 text-sm">settled up</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {friends.length > 0 && (
            <button onClick={() => setView('addTab')} className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20">
              <Plus className="w-5 h-5" />
              New Tab
            </button>
          )}
        </div>
      )}

      {view === 'addFriend' && (
        <div className="max-w-2xl mx-auto px-4 py-6">
          <button onClick={() => setView('home')} className="text-gray-400 hover:text-white mb-6 flex items-center gap-2">
            ← Back
          </button>
          <div className="glassmorphism rounded-2xl p-6 border">
            <h2 className="text-2xl font-bold mb-6">Add a Friend</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Search by username</label>
                <input type="text" value={friendSearchQuery} onChange={(e) => handleFriendSearch(e.target.value)}
                  placeholder="Type username..." className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-4 py-3 text-white" />
              </div>
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map(user => (
                    <div key={user.id} className="bg-slate-800/30 border border-white/10 rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{user.name}</p>
                        <p className="text-sm text-gray-400">@{user.username}</p>
                      </div>
                      <button onClick={() => addFriend(user.id)} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm">
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {view === 'addTab' && (
        <div className="max-w-2xl mx-auto px-4 py-6">
          <button onClick={() => setView('home')} className="text-gray-400 hover:text-white mb-6 flex items-center gap-2">← Back</button>
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
              <button onClick={addTab} disabled={!tabForm.amount || !tabForm.friendId}
                className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 text-white font-semibold py-3 rounded-xl mt-6">
                Create Tab
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'friendDetail' && selectedFriend && (
        <div className="max-w-2xl mx-auto px-4 py-6">
          <button onClick={() => setView('home')} className="text-gray-400 hover:text-white mb-6 flex items-center gap-2">← Back</button>
          <div className="glassmorphism rounded-2xl p-6 border mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-slate-700/50 p-4 rounded-full">
                <User className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold">{selectedFriend.name}</h2>
                <p className="text-gray-400">@{selectedFriend.username}</p>
              </div>
              <button onClick={() => deleteFriend(selectedFriend.id)} className="text-red-400/70 hover:text-red-400 p-2">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
            {(() => {
              const balance = calculateNetBalance(selectedFriend.id);
              const isPositive = balance > 0;
              const isNegative = balance < 0;
              return Math.abs(balance) > 0.01 ? (
                <div>
                  <div className={`rounded-xl p-4 border mb-4 ${isPositive ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                    <p className="text-sm text-gray-400 mb-1">Net balance</p>
                    <p className={`text-3xl font-bold font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      ${Math.abs(balance).toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-400 mt-1">{isPositive ? `${selectedFriend.name} owes you` : `You owe ${selectedFriend.name}`}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => handleSettleClick(selectedFriend)}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2">
                      <Check className="w-4 h-4" />
                      Settle Up
                    </button>
                    {isPositive && (
                      <button onClick={() => sendReminder(selectedFriend)}
                        className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2">
                        <Bell className="w-4 h-4" />
                        Remind
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-800/30 rounded-xl p-4 border border-white/10 text-center">
                  <p className="text-emerald-400 font-semibold">✨ All settled up!</p>
                </div>
              );
            })()}
          </div>
          <div className="space-y-3">
            <h3 className="text-lg font-bold text-gray-300">Active Tabs</h3>
            {getFriendTabs(selectedFriend.id, false).map(tab => (
              <div key={tab.id} className="glassmorphism rounded-xl p-4 border tab-card">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="font-semibold text-lg">{tab.description || 'No description'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Calendar className="w-3 h-3 text-gray-500" />
                      <span className="text-sm text-gray-400">{new Date(tab.date).toLocaleDateString()}</span>
                      {tab.status === 'pending_settlement' && (
                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">Pending Approval</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold font-mono ${tab.type === 'owed' ? 'text-emerald-400' : 'text-red-400'}`}>
                      ${tab.amount}
                    </p>
                    <p className="text-xs text-gray-500">{tab.type === 'owed' ? 'they owe' : 'you owe'}</p>
                  </div>
                </div>
                {tab.status === 'pending_settlement' && tab.type === 'owed' && (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => approveSettlement(selectedFriend.id)}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-lg text-sm">
                      Approve
                    </button>
                    <button onClick={() => denySettlement(selectedFriend.id)}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-sm">
                      Deny
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'settled' && (
        <div className="max-w-2xl mx-auto px-4 py-6">
          <button onClick={() => setView('home')} className="text-gray-400 hover:text-white mb-6 flex items-center gap-2">← Back</button>
          <h2 className="text-2xl font-bold mb-6">Settled Tabs</h2>
          {Object.keys(getSettledTabs()).length === 0 ? (
            <div className="glassmorphism rounded-2xl p-8 text-center border">
              <HistoryIcon className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p className="text-gray-400">No settled tabs yet</p>
            </div>
          ) : (
            Object.values(getSettledTabs()).map(({ friend, tabs: settledTabs }) => (
              <div key={friend.id} className="glassmorphism rounded-2xl p-6 border mb-6">
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
        <div className="max-w-2xl mx-auto px-4 py-6">
          <button onClick={() => setView('home')} className="text-gray-400 hover:text-white mb-6 flex items-center gap-2">← Back</button>
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
    </div>
  );
}