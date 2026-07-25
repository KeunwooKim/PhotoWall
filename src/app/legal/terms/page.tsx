import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import { LEGAL_META } from "@/lib/legal/meta";

export const metadata = {
  title: "이용약관 · PhotoWall",
  description: "PhotoWall 서비스 이용약관",
};

export default function TermsPage() {
  return (
    <AppShell>
      <article className="space-y-8 pb-10 text-sm leading-relaxed text-foreground">
        <header className="space-y-2">
          <p className="text-xs text-muted">
            <Link href="/" className="hover:text-foreground">
              홈
            </Link>
            {" · "}
            <Link href="/legal/privacy" className="hover:text-foreground">
              개인정보처리방침
            </Link>
          </p>
          <h1 className="text-2xl font-bold tracking-tight">이용약관</h1>
          <p className="text-xs text-muted">시행일: {LEGAL_META.effectiveDate}</p>
        </header>

        <Section title="제1조 (목적)">
          본 약관은 PhotoWall 운영자(이하 &quot;회사&quot;)가 제공하는 디지털 포토월 서비스
          &apos;PhotoWall&apos;(이하 &quot;서비스&quot;)의 이용과 관련하여, 회사와 이용자 간의 권리,
          의무, 책임사항 및 기타 필요한 사항을 규정함을 목적으로 합니다.
        </Section>

        <Section title="제2조 (정의)">
          본 약관에서 사용하는 용어의 정의는 다음과 같습니다.
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              <strong>&quot;서비스&quot;</strong>란 단말기(PC, 휴대형 단말기 등)와 상관없이
              이용자가 네컷 사진 등을 디지털 벽에 붙이고 꾸미며 공유할 수 있도록 회사가
              제공하는 PhotoWall 관련 제반 서비스를 의미합니다.
            </li>
            <li>
              <strong>&quot;이용자&quot;</strong>란 본 약관에 따라 회사와 이용계약을 체결하고
              회사가 제공하는 서비스를 이용하는 자를 의미합니다.
            </li>
            <li>
              <strong>&quot;콘텐츠&quot;</strong>란 이용자가 서비스 내에 게시, 업로드, 공유하는
              사진, 글, 스티커, 꾸미기 요소 등 일체의 정보를 의미합니다.
            </li>
            <li>
              <strong>&quot;공동 벽&quot;</strong>이란 두 명 이상의 이용자가 함께 접근하여
              콘텐츠를 게시하고 편집할 수 있도록 설정된 공유 포토월 공간을 의미합니다.
            </li>
          </ul>
        </Section>

        <Section title="제3조 (약관의 효력 및 변경)">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              본 약관은 서비스 내 화면에 게시하거나 기타의 방법으로 이용자에게
              공지함으로써 효력이 발생합니다.
            </li>
            <li>회사는 관련 법령을 위배하지 않는 범위 내에서 본 약관을 개정할 수 있습니다.</li>
            <li>
              회사가 약관을 개정할 경우, 적용일자 및 개정사유를 명시하여 현행 약관과 함께
              서비스 내에 그 적용일자 7일 전부터 공지합니다. 단, 이용자에게 불리한 변경의
              경우 30일 전부터 공지합니다.
            </li>
          </ol>
        </Section>

        <Section title="제4조 (서비스의 내용 및 중단)">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              회사는 개인 벽 꾸미기, 공동 벽 개설 및 초대, 친구 맺기 및 콘텐츠 공유 등의
              서비스를 제공합니다.
            </li>
            <li>
              회사는 컴퓨터 등 정보통신설비의 보수점검, 교체 및 고장, 통신두절 또는
              운영상 합리적인 이유가 있는 경우 서비스의 제공을 일시적으로 중단할 수
              있습니다. 이 경우 회사는 사전에 공지하며, 부득이한 경우 사후에 통지할 수
              있습니다.
            </li>
          </ol>
        </Section>

        <Section title="제4조의2 (테스트 서비스 운영에 관한 특례)">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              본 서비스는 현재 정식 출시 전 시스템 안정성 점검 및 기능 개선을 위한
              테스트(베타) 서비스 기간 중입니다.
            </li>
            <li>
              테스트 서비스 기간 중에는 시스템의 오류, 불안정, 잦은 기능 변경 등이 발생할
              수 있으며, 회사는 사전 예고 없이 서비스의 일부 또는 전부를 일시 중단하거나
              종료할 수 있습니다.
            </li>
            <li>
              테스트 및 시스템 최적화 목적상, 이용자의 계정 정보나 이용자가 업로드한
              콘텐츠(사진, 꾸미기 데이터 등), 공동 벽의 데이터가 사전 통지 없이
              초기화(리셋), 변경 또는 삭제될 수 있습니다.
            </li>
            <li>
              회사는 본 조에 따른 테스트 서비스의 불안정성, 서비스 중단, 데이터 손실
              등으로 인하여 이용자에게 발생한 손해에 대하여, 회사의 고의 또는 중대한
              과실이 없는 한 일체의 책임을 지지 않습니다.
            </li>
          </ol>
        </Section>

        <Section title="제5조 (회원가입 및 계정)">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              회원가입은 이용자가 타사의 계정(Google OAuth 등)을 연동하여 가입을
              신청하고, 회사가 이를 승낙함으로써 완료됩니다.
            </li>
            <li>
              본 서비스는 만 14세 이상만 이용할 수 있습니다. 만 14세 미만의 아동은 서비스
              가입 및 이용이 엄격히 금지됩니다.
            </li>
            <li>
              이용자는 계정 관리에 대한 책임이 있으며, 자신의 계정을 제3자에게 이용하게
              해서는 안 됩니다.
            </li>
          </ol>
        </Section>

        <Section title="제6조 (유료 서비스)">
          <ol className="list-decimal space-y-2 pl-5">
            <li>회사가 제공하는 서비스는 원칙적으로 무료입니다.</li>
            <li>
              회사는 추후 특정 기능이나 용량을 확장하는 &quot;플러스&quot; 등의 유료 서비스를
              도입할 수 있으며, 유료 서비스의 상세 요금, 결제 방식, 환불 규정 등은 별도의
              이용조건 및 안내 페이지를 통해 규정합니다.
            </li>
          </ol>
        </Section>

        <Section title="제7조 (이용자의 의무 및 금지행위)">
          이용자는 다음 각 호의 행위를 하여서는 안 됩니다.
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>법령, 공공질서 및 미풍양속에 위반되는 콘텐츠를 게시하는 행위</li>
            <li>
              회사 또는 제3자의 저작권, 초상권 등 지식재산권 및 기타 권리를 침해하는 행위
            </li>
            <li>다른 이용자의 개인정보를 동의 없이 수집, 저장, 공개하는 행위</li>
            <li>
              해킹, 악성코드 유포, 시스템의 취약점을 악용하는 등 서비스의 정상적인 운영을
              방해하는 행위
            </li>
            <li>영리 목적의 광고성 정보를 회사의 사전 동의 없이 게시하는 행위</li>
          </ul>
        </Section>

        <Section title="제8조 (이용자 콘텐츠의 권리 및 사용)">
          <ol className="list-decimal space-y-2 pl-5">
            <li>이용자가 서비스 내에 게시한 콘텐츠의 저작권은 해당 이용자에게 귀속됩니다.</li>
            <li>
              이용자는 자신이 게시한 콘텐츠가 제3자의 권리를 침해하지 않음을 보증해야
              합니다.
            </li>
            <li>
              회사는 서비스의 원활한 제공, 노출, 홍보, 개선을 위하여 필요한 최소한의 범위
              내에서 이용자의 콘텐츠를 무상으로 복제, 전송, 전시할 수 있는 이용허락을
              받습니다.
            </li>
            <li>
              &quot;공동 벽&quot;에 게시된 콘텐츠는 해당 공간에 참여한 다른 이용자에 의해 열람,
              편집, 삭제, 공유될 수 있으며, 이용자는 공동 벽의 특성상 이러한 상호작용에
              동의한 것으로 간주합니다.
            </li>
          </ol>
        </Section>

        <Section title="제9조 (이용제한 및 탈퇴)">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              이용자는 언제든지 서비스 내 설정 메뉴를 통해 회원 탈퇴를 요청할 수 있으며,
              회사는 관련 법령 등에 따라 즉시 처리합니다.
            </li>
            <li>
              회사는 이용자가 본 약관 제7조를 위반하거나 서비스의 정상적인 운영을 방해한
              경우, 사전 통지 없이 계정 이용을 제한하거나 계약을 해지할 수 있습니다.
            </li>
          </ol>
        </Section>

        <Section title="제10조 (면책 조항)">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              회사는 천재지변, 서비스 제공업체의 장애, 기타 불가항력으로 인하여 서비스를
              제공할 수 없는 경우에는 서비스 제공에 관한 책임이 면제됩니다.
            </li>
            <li>
              회사는 이용자가 서비스에 게시한 콘텐츠의 신뢰도, 정확성, 적법성에 대해
              책임을 지지 않습니다.
            </li>
            <li>
              회사는 이용자 간 또는 이용자와 제3자 상호 간에 서비스를 매개로 발생한
              분쟁에 대해서는 개입할 의무가 없으며, 이로 인한 손해를 배상할 책임이
              없습니다.
            </li>
          </ol>
        </Section>

        <Section title="제11조 (개인정보의 보호)">
          회사는 관련 법령이 정하는 바에 따라 이용자의 개인정보를 보호하기 위해
          노력합니다. 개인정보의 보호 및 사용에 대해서는 관련 법령 및 회사의{" "}
          <Link href="/legal/privacy" className="underline underline-offset-2">
            개인정보처리방침
          </Link>
          이 적용됩니다.
        </Section>

        <Section title="제12조 (준거법 및 분쟁 해결)">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              본 약관의 해석 및 회사와 이용자 간의 분쟁에 대하여는 대한민국의 법률을
              적용합니다.
            </li>
            <li>
              서비스 이용과 관련하여 발생한 분쟁에 대해 소송이 제기될 경우,
              민사소송법상의 관할 법원을 전속관할로 합니다.
            </li>
          </ol>
        </Section>

        <Section title="제13조 (문의)">
          서비스 이용과 관련된 문의 및 불만 사항은 아래의 연락처로 접수하실 수 있습니다.
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              앱 내 문의:{" "}
              <Link href="/settings" className="underline underline-offset-2">
                설정 → 문의하기
              </Link>
            </li>
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

        <p className="text-xs text-muted">
          부칙 · 본 약관은 {LEGAL_META.effectiveDate}부터 시행됩니다.
        </p>
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
