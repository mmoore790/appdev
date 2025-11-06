import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, HelpCircle, Book, Users, Wrench, CreditCard, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface Message {
  id: number;
  text: string;
  isBot: boolean;
  timestamp: Date;
  category?: string;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: "jobs" | "customers" | "payments" | "general" | "tasks";
  keywords: string[];
}

const faqs: FAQ[] = [
  // Job Management FAQs
  {
    id: "create-job",
    question: "How do I create a new job?",
    answer: "To create a new job:\n1. Go to the Workshop page\n2. Click the 'Create Job' button\n3. Follow the step-by-step wizard:\n   - Enter customer details\n   - Add equipment information\n   - Describe the work needed\n   - Assign to a mechanic\n4. Click 'Create Job' to finish",
    category: "jobs",
    keywords: ["create", "new", "job", "workshop", "add"]
  },
  {
    id: "edit-job",
    question: "How do I edit or view a job?",
    answer: "To edit a job:\n1. Go to the Workshop page\n2. Find the job in the table\n3. Click 'View & Edit' on the job row\n4. Make your changes in the dialog\n5. Click 'Update Job' to save\n\nYou can also delete jobs from the edit dialog using the red 'Delete Job' button.",
    category: "jobs",
    keywords: ["edit", "update", "modify", "view", "change", "delete"]
  },
  {
    id: "job-status",
    question: "How do I change a job's status?",
    answer: "To change job status:\n1. Open the job in edit mode\n2. Select the new status from the Status dropdown\n3. If changing to 'Ready for Pickup', the customer will be automatically notified by email\n4. Click 'Update Job' to save\n\nAvailable statuses: Waiting Assessment, In Progress, Parts Ordered, On Hold, Ready for Pickup, Completed",
    category: "jobs",
    keywords: ["status", "progress", "complete", "ready", "pickup", "assessment"]
  },
  {
    id: "assign-job",
    question: "How do I assign a job to a mechanic?",
    answer: "To assign a job:\n1. Edit the job\n2. Use the 'Assigned To' dropdown\n3. Select the mechanic from the list\n4. Click 'Update Job'\n\nThe status will automatically change to 'In Progress' when you assign someone to the job.",
    category: "jobs",
    keywords: ["assign", "mechanic", "staff", "worker", "allocate"]
  },
  
  // Customer Management FAQs
  {
    id: "add-customer",
    question: "How do I add a new customer?",
    answer: "You can add customers in two ways:\n\n1. From the job creation wizard - enter their details and they'll be automatically created\n2. Go to Customers page → 'Add Customer' → fill in their information\n\nRequired: Name\nOptional: Email, Phone, Address, Notes",
    category: "customers",
    keywords: ["add", "new", "customer", "client", "contact"]
  },
  {
    id: "customer-equipment",
    question: "How do I add equipment to a customer?",
    answer: "To add equipment:\n1. Go to Customers page\n2. Find the customer and click 'View Equipment'\n3. Click 'Add Equipment'\n4. Fill in: Brand, Model, Serial Number, Purchase Date, Notes\n5. Click 'Add Equipment'\n\nEquipment will then be available when creating jobs for that customer.",
    category: "customers",
    keywords: ["equipment", "machinery", "tools", "serial", "brand", "model"]
  },
  
  // Payment FAQs
  {
    id: "request-payment",
    question: "How do I request payment from a customer?",
    answer: "To request payment:\n1. Go to Payments page\n2. Click 'Request Payment'\n3. Select the job\n4. Enter the amount\n5. Add description (optional)\n6. Click 'Send Payment Request'\n\nThe customer will receive an email with a secure payment link powered by Stripe.",
    category: "payments",
    keywords: ["payment", "request", "money", "invoice", "charge", "stripe"]
  },
  {
    id: "payment-status",
    question: "How do I check if a payment was received?",
    answer: "To check payment status:\n1. Go to the Payments page\n2. Look at the Status column:\n   - 'Pending' = waiting for payment\n   - 'Paid' = payment completed\n   - 'Failed' = payment unsuccessful\n\nPayments are automatically updated when customers pay through the Stripe link.",
    category: "payments",
    keywords: ["payment", "status", "paid", "pending", "received", "check"]
  },
  
  // Task Management FAQs
  {
    id: "create-task",
    question: "How do I create and manage tasks?",
    answer: "To create tasks:\n1. Go to Task Board page\n2. Click 'Create Task'\n3. Fill in: Title, Description, Priority, Assign to staff\n4. Click 'Create Task'\n\nTo complete tasks:\n1. Find the task on the Task Board\n2. Click 'Mark Complete'\n3. Add completion notes\n4. Click 'Complete Task'",
    category: "tasks",
    keywords: ["task", "todo", "assignment", "complete", "priority", "board"]
  },
  
  // General FAQs
  {
    id: "dashboard",
    question: "What information is shown on the dashboard?",
    answer: "The dashboard shows:\n- Active Jobs count\n- Pending Tasks count\n- Workshop capacity status\n- Recent activities\n- Quick actions for common tasks\n\nUse the dashboard as your daily overview of workshop operations.",
    category: "general",
    keywords: ["dashboard", "overview", "summary", "activities", "status"]
  },
  {
    id: "callbacks", 
    question: "How do I manage customer callbacks?",
    answer: "To manage callbacks:\n1. Go to Callbacks page\n2. View all customer callback requests\n3. Use filters to find specific requests\n4. Click 'Mark Complete' when you've called the customer back\n\nCustomers can request callbacks through the public job tracker using their job ID and email.",
    category: "general",
    keywords: ["callback", "call", "customer", "contact", "request", "phone"]
  },
  {
    id: "job-tracker",
    question: "How can customers track their jobs?",
    answer: "Customers can track jobs by:\n1. Going to the public job tracker (available without login)\n2. Entering their Job ID (e.g., WS-1001)\n3. Entering their email address\n4. Viewing their job status and requesting callbacks\n\nShare the job tracker link with customers so they can check progress anytime.",
    category: "general",
    keywords: ["track", "tracker", "customer", "public", "status", "progress"]
  },
  {
    id: "help-navigation",
    question: "How do I navigate around the system?",
    answer: "The main navigation is on the left sidebar:\n\n• Dashboard - Overview and recent activity\n• Workshop - Create and manage jobs\n• Task Board - Create and track tasks\n• Callbacks - Manage customer callback requests\n• Payments - Request and track payments\n• Analytics - View reports and metrics\n• Settings - Manage users and system settings\n\nOn mobile, tap the menu icon to access navigation.",
    category: "general",
    keywords: ["navigate", "navigation", "menu", "sidebar", "mobile", "pages"]
  },
  {
    id: "workshop-capacity",
    question: "How do I monitor workshop capacity?",
    answer: "Workshop capacity is shown on the Dashboard:\n\n• Active Jobs counter shows current workload\n• Workshop metrics display jobs in progress\n• Date filters help you see historical workload\n• The analytics page provides detailed capacity reports\n\nUse this information to balance workload among mechanics and plan scheduling.",
    category: "jobs",
    keywords: ["capacity", "workload", "metrics", "analytics", "scheduling"]
  },
  {
    id: "print-receipts",
    question: "How do I print job receipts and work orders?",
    answer: "To print job documents:\n\n1. After creating a job, click 'Print Receipt' in the dialog\n2. From Workshop page, use the 'Print Work Orders' button\n3. Select specific jobs or date ranges to print\n4. Documents include job details, customer info, and work descriptions\n\nReceipts are professionally formatted and include your company branding.",
    category: "jobs",
    keywords: ["print", "receipt", "work", "order", "document", "paper"]
  }
];

const categoryIcons = {
  jobs: Wrench,
  customers: Users,
  payments: CreditCard,
  tasks: Book,
  general: HelpCircle
};

const categoryColors = {
  jobs: "bg-blue-100 text-blue-800",
  customers: "bg-green-100 text-green-800", 
  payments: "bg-purple-100 text-purple-800",
  tasks: "bg-orange-100 text-orange-800",
  general: "bg-gray-100 text-gray-800"
};

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "Hello! I'm here to help you use the Moore Horticulture Equipment Management System. You can ask me questions about jobs, customers, payments, and more. Try asking something like 'How do I create a job?' or browse the categories below.",
      isBot: true,
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const findBestAnswer = (question: string): FAQ | null => {
    const lowerQuestion = question.toLowerCase();
    
    // First try exact matches in questions
    let bestMatch = faqs.find(faq => 
      faq.question.toLowerCase().includes(lowerQuestion) ||
      lowerQuestion.includes(faq.question.toLowerCase())
    );
    
    if (bestMatch) return bestMatch;

    // Then try keyword matches
    bestMatch = faqs.find(faq =>
      faq.keywords.some(keyword => lowerQuestion.includes(keyword))
    );
    
    if (bestMatch) return bestMatch;

    // Try partial matches
    const words = lowerQuestion.split(' ').filter(word => word.length > 2);
    bestMatch = faqs.find(faq =>
      words.some(word =>
        faq.keywords.some(keyword => keyword.includes(word) || word.includes(keyword))
      )
    );

    return bestMatch || null;
  };

  const handleSendMessage = () => {
    if (!input.trim()) return;

    const newMessage: Message = {
      id: messages.length + 1,
      text: input,
      isBot: false,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newMessage]);

    // Find answer
    const answer = findBestAnswer(input);
    
    setTimeout(() => {
      const botResponse: Message = {
        id: messages.length + 2,
        text: answer ? answer.answer : "I'm not sure about that specific question. Try asking about:\n- Creating or editing jobs\n- Managing customers and equipment\n- Payment requests and tracking\n- Task management\n- Using the dashboard\n\nOr browse the categories below for common questions.",
        isBot: true,
        timestamp: new Date(),
        category: answer?.category
      };
      
      setMessages(prev => [...prev, botResponse]);
    }, 500);

    setInput("");
  };

  const handleQuickQuestion = (faq: FAQ) => {
    const questionMessage: Message = {
      id: messages.length + 1,
      text: faq.question,
      isBot: false,
      timestamp: new Date(),
    };

    const answerMessage: Message = {
      id: messages.length + 2,
      text: faq.answer,
      isBot: true,
      timestamp: new Date(),
      category: faq.category
    };

    setMessages(prev => [...prev, questionMessage, answerMessage]);
  };

  const getCategoryFAQs = () => {
    if (!selectedCategory) return faqs;
    return faqs.filter(faq => faq.category === selectedCategory);
  };

  const categories = [
    { key: "jobs", label: "Workshop Jobs", icon: Wrench },
    { key: "customers", label: "Customers", icon: Users },
    { key: "payments", label: "Payments", icon: CreditCard },
    { key: "tasks", label: "Tasks", icon: Book },
    { key: "general", label: "General Help", icon: HelpCircle }
  ];

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 rounded-full w-14 h-14 bg-primary hover:bg-primary/90 shadow-lg"
        size="lg"
      >
        <MessageCircle size={24} />
        <span className="sr-only">Open help chat</span>
      </Button>
    );
  }

  return (
    <Card className="fixed bottom-6 right-4 z-50 w-96 h-[32rem] shadow-xl max-h-[calc(100vh-3rem)]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-primary text-primary-foreground rounded-t-lg">
        <CardTitle className="text-sm font-medium">Help & Support</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(false)}
          className="h-6 w-6 p-0 text-primary-foreground hover:bg-primary-foreground/20"
        >
          <X size={16} />
        </Button>
      </CardHeader>
      
      <CardContent className="p-0 flex flex-col h-full">
        {/* Category Tabs */}
        <div className="flex gap-1 p-2 border-b bg-muted/30">
          <Button
            variant={selectedCategory === null ? "default" : "ghost"}
            size="sm"
            onClick={() => setSelectedCategory(null)}
            className="h-7 px-2 text-xs"
          >
            All
          </Button>
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <Button
                key={category.key}
                variant={selectedCategory === category.key ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectedCategory(category.key)}
                className="h-7 px-2 text-xs"
              >
                <Icon size={12} className="mr-1" />
                {category.label.split(' ')[0]}
              </Button>
            );
          })}
        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-3">
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isBot ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    message.isBot
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{message.text}</div>
                  {message.category && (
                    <Badge className={`mt-1 text-xs ${categoryColors[message.category as keyof typeof categoryColors]}`}>
                      {categories.find(c => c.key === message.category)?.label}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div ref={messagesEndRef} />
        </ScrollArea>

        {/* Quick Questions */}
        <div className="border-t p-2">
          <div className="text-xs font-medium text-muted-foreground mb-2">Quick Questions:</div>
          <div className="grid grid-cols-1 gap-1 max-h-20 overflow-y-auto">
            {getCategoryFAQs().slice(0, 3).map((faq) => (
              <Button
                key={faq.id}
                variant="ghost"
                size="sm"
                onClick={() => handleQuickQuestion(faq)}
                className="justify-start h-auto p-1 text-xs text-left whitespace-normal"
              >
                {faq.question}
              </Button>
            ))}
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t p-3 pb-6">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              className="text-sm"
            />
            <Button onClick={handleSendMessage} size="sm">
              <Send size={16} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}