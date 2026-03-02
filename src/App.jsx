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

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="text-center py-12">
          <h2 className="text-3xl font-bold mb-4">Welcome to Tabs!</h2>
          <p className="text-gray-400 mb-8">Your expense tracking app is ready.</p>
          <p className="text-emerald-400 text-sm">Full UI with all features coming in next update...</p>
        </div>
      </div>
    </div>
  );
}