import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { LEGAL_META } from "@/lib/legal/meta";

export const metadata = {
  title: "개인정보처리방침 · PhotoWall",
  description: "PhotoWall 개인정보처리방침",
};

export default function PrivacyPage() {
  return (
    <AppShell>
      <article className="space-y-8 pb-10 text-sm leading-relaxed text-foreground">
        <header className="space-y-2">
          <p className="text-xs text-muted">
            <Link href="/" className="hover:text-foreground">
              홈
            </Link>
            {" · "}
            <Link href="/legal/terms" className="hover:text-foreground">
              이용약관
            </Link>
          </p>
          <h1 className="text-2xl font-bold tracking-tight">개인정보처리방침</h1>
          <p className="text-xs text-muted">시행일: {LEGAL_META.effectiveDate}</p>
        </header>

        <p className="text-muted">
          PhotoWall 운영자(이하 &quot;회사&quot;)는 이용자의 개인정보를 중요시하며, 「개인정보
          보호법」 등 관련 법령을 준수하고 있습니다. 회사는 본 개인정보처리방침을 통하여
          이용자가 제공하는 개인정보가 어떠한 용도와 방식으로 이용되고 있으며, 개인정보
          보호를 위해 어떠한 조치가 취해지고 있는지 알려드립니다.
        </p>

        <Section title="1. 개인정보의 수집 항목 및 방법">
          <p className="mb-2">
            회사는 서비스 제공을 위해 아래와 같은 최소한의 개인정보를 수집합니다.
          </p>
          <div className="overflow-x-auto rounded-xl bg-foreground/[0.03]">
            <table className="w-full min-w-[28rem] text-left text-xs">
              <thead>
                <tr className="border-b border-foreground/10 text-muted">
                  <th className="px-3 py-2 font-medium">수집 시점</th>
                  <th className="px-3 py-2 font-medium">수집 항목</th>
                  <th className="px-3 py-2 font-medium">수집 방법</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-foreground/6">
                  <td className="px-3 py-2">회원가입 (Google 연동)</td>
                  <td className="px-3 py-2">
                    구글 계정 식별자(OpenID), 이메일 주소, 프로필 이름
                  </td>
                  <td className="px-3 py-2">OAuth 연동을 통한 자동 수집</td>
                </tr>
                <tr className="border-b border-foreground/6">
                  <td className="px-3 py-2">서비스 이용 과정</td>
                  <td className="px-3 py-2">
                    IP 주소, 서비스 이용 기록(접속 로그, 콘텐츠 업로드 이력), 기기 정보
                  </td>
                  <td className="px-3 py-2">시스템을 통한 자동 생성 및 수집</td>
                </tr>
                <tr>
                  <td className="px-3 py-2">고객 문의</td>
                  <td className="px-3 py-2">문의 내용, 이메일 주소</td>
                  <td className="px-3 py-2">앱 내 문의 또는 이메일 접수</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="2. 개인정보의 이용 목적">
          회사는 수집한 개인정보를 다음의 목적을 위해 이용합니다.
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>회원 식별, 가입 의사 확인, 연령 확인(만 14세 이상)</li>
            <li>개인 벽 및 공동 벽 서비스 제공, 친구 맺기 및 콘텐츠 공유 기능 지원</li>
            <li>테스트(베타) 서비스 기간 중 오류 수정, 시스템 안정성 점검 및 기능 개선</li>
            <li>고객 문의 응대 및 불만 처리, 공지사항 전달</li>
            <li>부정이용 방지 및 비인가 사용 제재</li>
          </ul>
        </Section>

        <Section title="3. 개인정보의 보유 및 이용 기간">
          <p>
            회사는 원칙적으로 이용자의 회원 탈퇴 시까지 개인정보를 보유 및 이용하며, 탈퇴
            요청 시 해당 정보를 지체 없이 파기합니다. 또한, 테스트 서비스 종료 시 또는
            시스템 초기화 과정에서 수집된 정보가 일괄 파기될 수 있습니다. 단, 관계 법령에
            의해 보존할 필요가 있는 경우 아래와 같이 일정 기간 보관합니다.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래 등에서의
              소비자보호에 관한 법률)
            </li>
            <li>웹사이트 방문 기록 (로그기록, IP 등): 3개월 (통신비밀보호법)</li>
          </ul>
        </Section>

        <Section title="4. 개인정보의 제3자 제공">
          회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만, 이용자가
          사전에 동의한 경우나 법령의 규정에 의거하여 수사 목적으로 적법한 절차에 따라
          요구받은 경우는 예외로 합니다.
        </Section>

        <Section title="5. 개인정보 처리 위탁">
          <p className="mb-2">
            회사는 원활한 서비스 제공을 위해 아래와 같이 개인정보 처리 업무를 외부
            전문업체에 위탁하고 있습니다.
          </p>
          <div className="overflow-x-auto rounded-xl bg-foreground/[0.03]">
            <table className="w-full min-w-[28rem] text-left text-xs">
              <thead>
                <tr className="border-b border-foreground/10 text-muted">
                  <th className="px-3 py-2 font-medium">수탁자</th>
                  <th className="px-3 py-2 font-medium">위탁 업무 내용</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-foreground/6">
                  <td className="px-3 py-2">Supabase</td>
                  <td className="px-3 py-2">
                    데이터베이스, 스토리지(사진 등 콘텐츠 저장) 및 인증(Auth) 시스템 운영
                  </td>
                </tr>
                <tr className="border-b border-foreground/6">
                  <td className="px-3 py-2">Vercel</td>
                  <td className="px-3 py-2">서비스 호스팅 및 클라우드 인프라 제공</td>
                </tr>
                <tr>
                  <td className="px-3 py-2">Google</td>
                  <td className="px-3 py-2">소셜 로그인 인증 서비스 제공</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="6. 개인정보의 국외 이전">
          <p>
            서비스 제공을 위해 수탁업체의 클라우드 서버(Supabase, Vercel 등)를 이용함에
            따라, 이용자의 개인정보가 국외로 이전, 저장될 수 있습니다.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>이전되는 항목: 회원가입 시 수집 항목 및 서비스 이용 기록, 업로드된 콘텐츠</li>
            <li>이전 국가 및 이전받는 자: 미국 등 (Supabase, Vercel)</li>
            <li>이전 목적: 글로벌 클라우드 인프라를 활용한 안정적인 데이터 저장 및 호스팅</li>
            <li>보존 기간: 회원 탈퇴 시 또는 위탁 계약 종료 시까지</li>
          </ul>
        </Section>

        <Section title="7. 이용자의 권리 및 행사 방법">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              이용자는 언제든지 자신의 개인정보를 조회하거나 수정할 수 있으며, 회원 탈퇴를
              통해 개인정보의 수집 및 이용 동의를 철회할 수 있습니다.
            </li>
            <li>
              권리 행사는 앱 내 &apos;설정&apos; 메뉴 또는 고객센터 이메일을 통해 가능하며, 회사는
              이에 대해 지체 없이 조치합니다.
            </li>
          </ol>
        </Section>

        <Section title="8. 쿠키(Cookie) 및 로컬 저장소 활용">
          회사는 이용자의 세션 유지 및 맞춤형 서비스 제공을 위해 로컬 스토리지(Local
          Storage) 및 세션(Session) 기반 기술을 사용할 수 있습니다. 이는 이용자의 기기에
          저장되며, 기기 설정이나 브라우저 옵션을 통해 차단할 수 있으나, 차단 시 정상적인
          서비스 이용에 어려움이 있을 수 있습니다.
        </Section>

        <Section title="9. 개인정보의 파기 절차 및 방법">
          <p>
            회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을
            때에는 지체 없이 해당 개인정보를 파기합니다.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              파기 절차: 탈퇴 시 또는 테스트 데이터 초기화 시 데이터베이스에서 이용자의
              식별 정보를 논리적/물리적으로 삭제(Hard Delete)합니다.
            </li>
            <li>
              파기 방법: 전자적 파일 형태의 정보는 기록을 재생할 수 없는 기술적 방법을
              사용하여 삭제합니다.
            </li>
          </ul>
        </Section>

        <Section title="10. 개인정보의 안전성 확보 조치">
          회사는 개인정보가 분실, 도난, 유출, 위조, 변조 또는 훼손되지 않도록 암호화
          통신(SSL/TLS 적용), 접근 권한 제어 등 기술적, 관리적 보호 조치를 취하고
          있습니다.
        </Section>

        <Section title="11. 아동의 개인정보 보호">
          회사는 만 14세 미만 아동의 서비스 이용을 제한하고 있으며, 회원가입을 허용하지
          않고 개인정보를 수집하지 않습니다. 아동의 정보가 수집된 사실을 인지할 경우
          지체 없이 정보와 계정을 파기합니다.
        </Section>

        <Section title="12. 민감정보 및 고유식별정보 처리">
          회사는 이용자의 사생활을 현저히 침해할 우려가 있는 민감정보(사상, 신념,
          건강상태 등) 및 고유식별정보(주민등록번호 등)를 원칙적으로 수집하지 않습니다.
        </Section>

        <Section title="13. 개인정보 보호책임자 및 문의처">
          개인정보 보호와 관련된 문의, 불만 처리 등을 위하여 아래와 같이 담당자를
          지정하고 있습니다.
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>담당자(또는 부서): PhotoWall 프라이버시 담당</li>
            <li>
              이메일:{" "}
              <a
                href={`mailto:${LEGAL_META.contactEmail}`}
                className="underline underline-offset-2"
              >
                {LEGAL_META.contactEmail}
              </a>
            </li>
          </ul>
        </Section>

        <Section title="14. 방침 변경에 따른 공지 의무">
          본 개인정보처리방침은 {LEGAL_META.effectiveDate}부터 적용됩니다. 법령 및 방침에
          따른 변경내용이 있을 경우 시행 7일 전부터 서비스 내 공지사항을 통하여
          고지합니다.
        </Section>
      </article>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="text-muted [&_strong]:text-foreground">{children}</div>
    </section>
  );
}
