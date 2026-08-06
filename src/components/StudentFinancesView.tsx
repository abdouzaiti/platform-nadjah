import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Loader2, Wallet, Users, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";

interface StudentFinanceData {
  id: string;
  fullname: string;
  email: string;
  phone?: string;
  username: string;
  created_at: string;
  joinedRooms: {
    room_id: string;
    room_name: string;
    community_name: string;
    teacher_name: string;
  }[];
}

export default function StudentFinancesView() {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState<StudentFinanceData[]>([]);

  const getLabel = (ar: string, fr: string, en: string) => {
    if (i18n.language === 'ar') return ar;
    if (i18n.language === 'fr') return fr;
    return en;
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch students
      const { data: studentsData, error: studentsError } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "student");

      if (studentsError) throw studentsError;

      // Fetch room members with room and community details
      const { data: roomMembersData, error: rmError } = await supabase
        .from("room_members")
        .select(`
          user_id,
          room_id,
          class_rooms (
            room_name,
            teacher_communities (
              community_name,
              profiles (fullname)
            )
          )
        `);

      if (rmError) throw rmError;

      const formattedData: StudentFinanceData[] = (studentsData || []).map((student: any) => {
        const studentRooms = (roomMembersData || [])
          .filter((rm: any) => rm.user_id === student.id)
          .map((rm: any) => ({
            room_id: rm.room_id,
            room_name: rm.class_rooms?.room_name || "Unknown Room",
            community_name: rm.class_rooms?.teacher_communities?.community_name || "Unknown Community",
            teacher_name: rm.class_rooms?.teacher_communities?.profiles?.fullname || "Unknown Teacher"
          }));

        return {
          id: student.id,
          fullname: student.fullname || "Unnamed",
          email: student.email,
          phone: student.phone,
          username: student.username,
          created_at: student.created_at,
          joinedRooms: studentRooms
        };
      });

      setStudents(formattedData);
    } catch (err: any) {
      console.error("Error fetching finances:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = students.filter(s => 
    s.fullname.toLowerCase().includes(search.toLowerCase()) || 
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-2xl font-black font-display uppercase italic tracking-tighter text-slate-900 leading-none flex items-center gap-3">
              <Wallet className="h-7 w-7 text-emerald-600" />
              <span>{getLabel("مالية الطلاب والاشتراكات", "Finances & Abonnements", "Student Finances & Subscriptions")}</span>
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
              {getLabel("إحصاء فصول الطلاب لحساب الأرباح", "Comptabiliser les classes des étudiants pour les bénéfices", "Track student classes for profit calculation")}
            </p>
          </div>
          
          <div className="relative max-w-sm w-full md:w-auto">
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={getLabel("بحث عن طالب...", "Rechercher...", "Search student...")}
              className="w-full bg-slate-50 border border-slate-100 pl-10 pr-4 py-3 rounded-2xl text-xs font-medium outline-none focus:border-emerald-500 focus:bg-white transition-all"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mb-4 text-emerald-500" />
            <p className="text-xs font-black uppercase tracking-widest">
              {getLabel("جاري التحميل...", "Chargement...", "Loading...")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left rtl:text-right">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">{getLabel("الطالب", "Étudiant", "Student")}</th>
                  <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">{getLabel("الفصول المنضمة", "Classes Rejointes", "Joined Classes")}</th>
                  <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400 px-2 text-center">{getLabel("العدد الإجمالي", "Total", "Total Classes")}</th>
                  <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-slate-400 px-2 text-center">{getLabel("الأرباح", "Bénéfices", "Profits")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-slate-400 text-xs font-medium">
                      {getLabel("لا يوجد طلاب", "Aucun étudiant", "No students found")}
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student) => (
                    <tr key={student.id} className="group hover:bg-slate-50/50 transition-all">
                      <td className="py-4 px-2">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 text-sm">{student.fullname}</span>
                          <span className="text-xs text-slate-400">@{student.username}</span>
                          <span className="text-xs text-slate-400">{student.email}</span>
                          {student.phone && <span className="text-xs text-slate-500 font-medium">{student.phone}</span>}
                          <span className="text-[10px] text-slate-400 mt-1">Joined: {new Date(student.created_at).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="py-4 px-2">
                        {student.joinedRooms.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {student.joinedRooms.map((room, idx) => (
                              <div key={idx} className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-xs flex flex-col border border-emerald-100/50">
                                <span className="font-bold">{room.room_name}</span>
                                <span className="text-[9px] opacity-70">{room.teacher_name}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">{getLabel("لم ينضم لأي فصل", "Aucune classe", "No classes")}</span>
                        )}
                      </td>
                      <td className="py-4 px-2 text-center">
                        <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-slate-100 text-slate-700 font-bold text-xs">
                          {student.joinedRooms.length}
                        </span>
                      </td>
                      <td className="py-4 px-2 text-center">
                        <span className="font-bold text-emerald-600 text-sm">
                          {student.joinedRooms.length * 1500} {getLabel("د.ج", "DA", "DZD")}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
