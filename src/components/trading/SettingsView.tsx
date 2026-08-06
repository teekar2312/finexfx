'use client';

import { useState } from 'react';
import { useTradingStore } from '@/store/trading-store';
import { BROKER_CONFIG } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Cog, Shield, Bell, Server, TriangleAlert, X, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { SYMBOLS, SYMBOL_INFO, type Symbol } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';

export default function SettingsView() {
  const {
    accountType, balance, isConnected, isAutoTrading,
    priceAlerts, addPriceAlert, removePriceAlert, togglePriceAlert,
    errorLogs, addNotification, notifications,
  } = useTradingStore();

  const [emailNotif, setEmailNotif] = useState(true);
  const [pushNotif, setPushNotif] = useState(true);
  const [newAlertSymbol, setNewAlertSymbol] = useState<Symbol>('EURUSD');
  const [newAlertCondition, setNewAlertCondition] = useState('above');
  const [newAlertPrice, setNewAlertPrice] = useState('1.10000');
  const [logFilter, setLogFilter] = useState<string>('all');

  const addNewAlert = () => {
    const price = parseFloat(newAlertPrice);
    if (isNaN(price)) {
      addNotification({ type: 'error', title: 'Invalid Price', message: 'Please enter a valid price.' });
      return;
    }
    addPriceAlert({
      symbol: newAlertSymbol,
      condition: newAlertCondition,
      price,
      isActive: true,
    });
    addNotification({ type: 'success', title: 'Alert Created', message: `${newAlertSymbol} ${newAlertCondition} ${price}` });
  };

  const filteredLogs = logFilter === 'all'
    ? errorLogs
    : errorLogs.filter(l => l.level === logFilter);

  return (
    <div className="p-4">
      <Tabs defaultValue="broker" className="w-full">
        <TabsList className="bg-card border border-border mb-4">
          <TabsTrigger value="broker" className="text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Server className="h-3.5 w-3.5 mr-1" />
            Broker
          </TabsTrigger>
          <TabsTrigger value="account" className="text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Shield className="h-3.5 w-3.5 mr-1" />
            Account
          </TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <Bell className="h-3.5 w-3.5 mr-1" />
            Alerts
          </TabsTrigger>
          <TabsTrigger value="logs" className="text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
            <TriangleAlert className="h-3.5 w-3.5 mr-1" />
            Error Logs
          </TabsTrigger>
        </TabsList>

        {/* Broker Configuration */}
        <TabsContent value="broker" className="space-y-4">
          <Card className="glass-card">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Broker Configuration</CardTitle>
                <Badge variant="outline" className="text-[10px] ml-auto border-emerald-500/50 text-emerald-500">Connected</Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: 'Broker Name', value: BROKER_CONFIG.name },
                  { label: 'Leverage', value: `1:${BROKER_CONFIG.leverage}` },
                  { label: 'Min Spread', value: `${BROKER_CONFIG.minSpread} pips` },
                  { label: 'Commission', value: `$${BROKER_CONFIG.commission}/lot` },
                  { label: 'Min Lot Size', value: BROKER_CONFIG.minLotSize.toString() },
                  { label: 'Max Lot Size', value: BROKER_CONFIG.maxLotSize.toString() },
                  { label: 'Max Open Positions', value: BROKER_CONFIG.maxOpenPositions.toString() },
                  { label: 'Margin Call Level', value: `${BROKER_CONFIG.marginCall}%` },
                  { label: 'Stop Out Level', value: `${BROKER_CONFIG.stopOut}%` },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.label}</span>
                    <span className="text-sm font-medium tabular-nums">{item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold">Server Status</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 pulse-dot' : 'bg-red-500'}`} />
                  <div>
                    <div className="text-[10px] text-muted-foreground">Connection</div>
                    <div className="text-xs font-medium">{isConnected ? 'Connected' : 'Disconnected'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <div>
                    <div className="text-[10px] text-muted-foreground">Price Feed</div>
                    <div className="text-xs font-medium">{isConnected ? 'Live' : 'Offline'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isAutoTrading ? 'bg-emerald-500 pulse-dot' : 'bg-slate-500'}`} />
                  <div>
                    <div className="text-[10px] text-muted-foreground">Auto Trading</div>
                    <div className="text-xs font-medium">{isAutoTrading ? 'Running' : 'Stopped'}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <div>
                    <div className="text-[10px] text-muted-foreground">Account</div>
                    <div className="text-xs font-medium">${balance.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Account Settings */}
        <TabsContent value="account" className="space-y-4">
          <Card className="glass-card">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold">Account Settings</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[11px] text-muted-foreground">Account Type</Label>
                  <div className="mt-1 p-2 rounded-lg bg-accent/50 border border-border">
                    <span className={`text-sm font-semibold ${accountType === 'live' ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {accountType === 'live' ? '● LIVE ACCOUNT' : '● DEMO ACCOUNT'}
                    </span>
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Leverage</Label>
                  <div className="mt-1 p-2 rounded-lg bg-accent/50 border border-border">
                    <span className="text-sm font-medium">1:{BROKER_CONFIG.leverage}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Account Currency</Label>
                  <div className="mt-1 p-2 rounded-lg bg-accent/50 border border-border">
                    <span className="text-sm font-medium">USD</span>
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Balance</Label>
                  <div className="mt-1 p-2 rounded-lg bg-accent/50 border border-border">
                    <span className="text-sm font-medium tabular-nums">${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <Separator className="opacity-50" />

              <div>
                <Label className="text-[11px] text-muted-foreground mb-2 block">Auto Trading</Label>
                <div className="flex items-center justify-between p-3 rounded-lg bg-accent/50 border border-border">
                  <div>
                    <div className="text-xs font-medium">Enable Auto Trading</div>
                    <div className="text-[10px] text-muted-foreground">AI will automatically execute trades based on signals</div>
                  </div>
                  <Switch
                    checked={isAutoTrading}
                    onCheckedChange={(checked) => {
                      useTradingStore.getState().setAutoTrading(checked);
                      addNotification({ type: 'info', title: 'Auto Trading', message: checked ? 'Auto trading enabled' : 'Auto trading disabled' });
                    }}
                    disabled={!isConnected}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2 pt-3 px-4">
              <CardTitle className="text-sm font-semibold">Notification Preferences</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-accent/50 border border-border">
                <div>
                  <div className="text-xs font-medium">Email Notifications</div>
                  <div className="text-[10px] text-muted-foreground">Receive trade alerts and reports via email</div>
                </div>
                <Switch checked={emailNotif} onCheckedChange={setEmailNotif} className="data-[state=checked]:bg-emerald-600" />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-accent/50 border border-border">
                <div>
                  <div className="text-xs font-medium">Push Notifications</div>
                  <div className="text-[10px] text-muted-foreground">Browser push notifications for important events</div>
                </div>
                <Switch checked={pushNotif} onCheckedChange={setPushNotif} className="data-[state=checked]:bg-emerald-600" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Price Alerts */}
        <TabsContent value="notifications" className="space-y-4">
          <Card className="glass-card">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-semibold">Price Alerts</CardTitle>
                <Badge variant="outline" className="text-[10px] ml-auto">{priceAlerts.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex flex-wrap items-end gap-2 mb-4">
                <div className="min-w-[100px]">
                  <Label className="text-[10px] text-muted-foreground">Symbol</Label>
                  <Select value={newAlertSymbol} onValueChange={(v) => setNewAlertSymbol(v as Symbol)}>
                    <SelectTrigger className="h-8 text-xs mt-0.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SYMBOLS.map(sym => (
                        <SelectItem key={sym} value={sym}>{sym}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[100px]">
                  <Label className="text-[10px] text-muted-foreground">Condition</Label>
                  <Select value={newAlertCondition} onValueChange={setNewAlertCondition}>
                    <SelectTrigger className="h-8 text-xs mt-0.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="above">Above</SelectItem>
                      <SelectItem value="below">Below</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[110px]">
                  <Label className="text-[10px] text-muted-foreground">Price</Label>
                  <Input
                    type="number"
                    value={newAlertPrice}
                    onChange={(e) => setNewAlertPrice(e.target.value)}
                    step="0.00001"
                    className="h-8 text-xs tabular-nums mt-0.5"
                  />
                </div>
                <Button onClick={addNewAlert} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground h-8">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              {priceAlerts.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">No price alerts configured</div>
              ) : (
                <div className="space-y-2">
                  {priceAlerts.map((alert) => (
                    <div key={alert.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${alert.isActive ? 'border-primary/20 bg-primary/5' : 'border-border opacity-50'}`}>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={alert.isActive}
                          onCheckedChange={() => togglePriceAlert(alert.id)}
                          className="scale-75 data-[state=checked]:bg-emerald-600"
                        />
                        <div>
                          <div className="text-xs font-medium">
                            {alert.symbol} <span className="text-muted-foreground">{alert.condition}</span>{' '}
                            <span className="tabular-nums">{alert.price.toFixed(SYMBOL_INFO[alert.symbol as Symbol]?.digits || 5)}</span>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500 hover:text-red-400 hover:bg-red-500/10" onClick={() => removePriceAlert(alert.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Error Logs */}
        <TabsContent value="logs" className="space-y-4">
          <Card className="glass-card">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TriangleAlert className="h-4 w-4 text-primary" />
                  <CardTitle className="text-sm font-semibold">Error Logs</CardTitle>
                  <Badge variant="outline" className="text-[10px]">{errorLogs.length} entries</Badge>
                </div>
                <Select value={logFilter} onValueChange={setLogFilter}>
                  <SelectTrigger className="w-[100px] h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              {errorLogs.length === 0 ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <div className="text-sm text-muted-foreground">No error logs recorded</div>
                  <div className="text-xs text-muted-foreground">Errors and warnings will appear here</div>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-1.5">
                    {filteredLogs.map((log, i) => (
                      <motion.div
                        key={log.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className={`p-2.5 rounded-lg border ${
                          log.level === 'error' ? 'border-red-500/20 bg-red-500/5' :
                          log.level === 'warning' ? 'border-amber-500/20 bg-amber-500/5' :
                          'border-border bg-accent/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1.5 py-0 ${
                                log.level === 'error' ? 'border-red-500/50 text-red-500' :
                                log.level === 'warning' ? 'border-amber-500/50 text-amber-500' :
                                'border-slate-500/50 text-slate-500'
                              }`}
                            >
                              {log.level.toUpperCase()}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">{log.source}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground tabular-nums">{log.timestamp}</span>
                        </div>
                        <div className="text-[11px]">{log.message}</div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
