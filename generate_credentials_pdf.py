import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
    KeepTogether,
)

def create_credentials_pdf(output_filename="FarmConnect_AI_Login_Credentials_and_Access_Guide.pdf"):
    doc = SimpleDocTemplate(
        output_filename,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    primary_color = colors.HexColor("#166534")  # Forest 800
    secondary_color = colors.HexColor("#15803d")  # Forest 700
    accent_red = colors.HexColor("#b91c1c")
    accent_blue = colors.HexColor("#1d4ed8")
    dark_slate = colors.HexColor("#0f172a")
    light_slate = colors.HexColor("#f8fafc")
    border_color = colors.HexColor("#e2e8f0")

    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=22,
        leading=26,
        textColor=primary_color,
    )

    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#64748b"),
    )

    h1_style = ParagraphStyle(
        "Heading1_Custom",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=17,
        textColor=dark_slate,
        spaceAfter=6,
    )

    body_style = ParagraphStyle(
        "Body_Custom",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=dark_slate,
    )

    code_style = ParagraphStyle(
        "Code_Custom",
        parent=styles["Normal"],
        fontName="Courier-Bold",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#0f172a"),
    )

    badge_farmer = ParagraphStyle(
        "BadgeFarmer",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#166534"),
    )

    badge_buyer = ParagraphStyle(
        "BadgeBuyer",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#1e40af"),
    )

    badge_admin = ParagraphStyle(
        "BadgeAdmin",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#991b1b"),
    )

    elements = []

    # 1. Header Banner
    elements.append(Paragraph("FarmConnect AI — Access & Credentials Guide", title_style))
    elements.append(
        Paragraph(
            "System Credentials, Demonstration Profiles, Access URLs, and Security Policies<br/>"
            "Problem Statement PS 1.2 • Direct Market-Access Platform for Marginal Farmers (Dakshina Kannada & Udupi)",
            subtitle_style,
        )
    )
    elements.append(Spacer(1, 10))
    elements.append(HRFlowable(width="100%", thickness=2, color=primary_color, spaceBefore=2, spaceAfter=14))

    # 2. Main Credentials Summary Table
    elements.append(Paragraph("1. Primary System Login Accounts", h1_style))
    elements.append(
        Paragraph(
            "The following demonstration accounts are pre-seeded in the database and ready for immediate login:",
            body_style,
        )
    )
    elements.append(Spacer(1, 6))

    table_data = [
        [
            Paragraph("<b>Role</b>", body_style),
            Paragraph("<b>Name & Organization</b>", body_style),
            Paragraph("<b>Login Email</b>", body_style),
            Paragraph("<b>Password</b>", body_style),
            Paragraph("<b>Key Permissions</b>", body_style),
        ],
        [
            Paragraph("<b>FARMER</b>", badge_farmer),
            Paragraph("Ramesh Rai<br/><font color='#64748b' size=7.5>Rai Betel & Arecanut Estate</font>", body_style),
            Paragraph("<b>ramesh@farmconnect.demo</b>", code_style),
            Paragraph("<b>FarmerPass123!</b>", code_style),
            Paragraph("FarmForensics (Crop Investigation), FarmLab, Produce Listing, Voice Listing, Group Selling", body_style),
        ],
        [
            Paragraph("<b>BUYER</b>", badge_buyer),
            Paragraph("Suresh Shetty<br/><font color='#64748b' size=7.5>Ocean Pearl Hotels, Mangalore</font>", body_style),
            Paragraph("<b>procurement@oceanpearlhotels.demo</b>", code_style),
            Paragraph("<b>BuyerPass123!</b>", code_style),
            Paragraph("Produce Marketplace, Demand Pool Creation, Bulk Purchasing, Escrow Payments", body_style),
        ],
        [
            Paragraph("<b>ADMIN</b>", badge_admin),
            Paragraph("Dr. Ananya Rao<br/><font color='#64748b' size=7.5>Agri Governance Director</font>", body_style),
            Paragraph("<b>admin@farmconnect.org</b>", code_style),
            Paragraph("<b>AdminPass123!</b>", code_style),
            Paragraph("Full Governance Audit, APMC Reference Price Updates, Dispute Moderation, Blockchain Ledger", body_style),
        ],
    ]

    t = Table(table_data, colWidths=[65, 120, 155, 95, 95])
    t.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ("TEXTCOLOR", (0, 0), (-1, 0), dark_slate),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("GRID", (0, 0), (-1, -1), 0.5, border_color),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#f0fdf4")),
            ("BACKGROUND", (0, 2), (-1, 2), colors.HexColor("#eff6ff")),
            ("BACKGROUND", (0, 3), (-1, 3), colors.HexColor("#fef2f2")),
        ])
    )
    elements.append(t)
    elements.append(Spacer(1, 14))

    # 3. Account Details & Features Breakdown
    elements.append(Paragraph("2. Profile Specifications & Capabilities", h1_style))

    cards_data = [
        [
            Paragraph("<b>Farmer Profile — Ramesh Rai (ರಮೇಶ್ ರೈ)</b>", badge_farmer),
            Paragraph(
                "• <b>Location:</b> Mani Village, Bantwal Taluk, Dakshina Kannada<br/>"
                "• <b>Landholding:</b> 2.5 Acres (Marginal Farmer Classification under PS 1.2)<br/>"
                "• <b>Soil & Irrigation:</b> Coastal Laterite soil, Rain-fed + Borewell<br/>"
                "• <b>Main Crops:</b> Arecanut (Chali/Bette), Black Pepper (Panniyur-1), GI Mattu Gulla<br/>"
                "• <b>FarmForensics:</b> Upload leaf/bunch photos (JPEG/PNG up to 10MB) for AI disease investigation.<br/>"
                "• <b>Smart Group Selling:</b> Participate in collective supply fulfillment with neighboring farmers.",
                body_style,
            ),
        ],
        [
            Paragraph("<b>Buyer Profile — Ocean Pearl Hotels (ಸಂಪೂರ್ಣ ಖರೀದಿ)</b>", badge_buyer),
            Paragraph(
                "• <b>Location:</b> Navabharath Circle, Mangalore Taluk, Dakshina Kannada<br/>"
                "• <b>Business Type:</b> Hospitality, bulk culinary catering, and restaurant procurement<br/>"
                "• <b>Marketplace:</b> Search fresh produce listings with taluk and quality grade filters.<br/>"
                "• <b>Demand Pooling:</b> Request custom bulk quantities exceeding single-farmer capacity.<br/>"
                "• <b>Escrow & Settlement:</b> Fund secure escrow smart contracts with instant automated refund/release.",
                body_style,
            ),
        ],
        [
            Paragraph("<b>Admin Profile — Dr. Ananya Rao (ಆಡಳಿತ ಪರಿಶೀಲನೆ)</b>", badge_admin),
            Paragraph(
                "• <b>Location:</b> Hampankatta, Mangalore, Dakshina Kannada<br/>"
                "• <b>Role:</b> Agricultural Governance & Platform Compliance Officer<br/>"
                "• <b>Market Oversight:</b> Review and update APMC Mandi benchmark prices (Bantwal, Puttur, Udupi).<br/>"
                "• <b>Traceability:</b> View cryptographic batch records, QR timestamps, and smart contract hashes.<br/>"
                "• <b>Moderation:</b> Investigate disputes, inspect audit logs, and oversee tokenized transactions.",
                body_style,
            ),
        ],
    ]

    ct = Table(cards_data, colWidths=[150, 380])
    ct.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("GRID", (0, 0), (-1, -1), 0.5, border_color),
            ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#f0fdf4")),
            ("BACKGROUND", (0, 1), (0, 1), colors.HexColor("#eff6ff")),
            ("BACKGROUND", (0, 2), (0, 2), colors.HexColor("#fef2f2")),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ])
    )
    elements.append(ct)
    elements.append(Spacer(1, 14))

    # 4. Local Test Blockchain Wallets (Hardhat)
    elements.append(Paragraph("3. Local Blockchain Accounts & Test Wallets", h1_style))
    elements.append(
        Paragraph(
            "When testing smart contracts (Order Escrow, Agreement Registry, Traceability, Farm Token):",
            body_style,
        )
    )
    elements.append(Spacer(1, 5))

    chain_data = [
        [
            Paragraph("<b>Account</b>", body_style),
            Paragraph("<b>Public Wallet Address</b>", body_style),
            Paragraph("<b>Private Key (Local Testnet Only)</b>", body_style),
            Paragraph("<b>Balance</b>", body_style),
        ],
        [
            Paragraph("<b>Deployer / Admin</b>", body_style),
            Paragraph("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", code_style),
            Paragraph("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", code_style),
            Paragraph("10,000 ETH", body_style),
        ],
        [
            Paragraph("<b>Farmer (Ramesh)</b>", body_style),
            Paragraph("0x70997970C51812dc3A010C7d01b50e0d17dc79C8", code_style),
            Paragraph("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", code_style),
            Paragraph("10,000 ETH", body_style),
        ],
        [
            Paragraph("<b>Buyer (Ocean Pearl)</b>", body_style),
            Paragraph("0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", code_style),
            Paragraph("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", code_style),
            Paragraph("10,000 ETH", body_style),
        ],
    ]

    ch_table = Table(chain_data, colWidths=[95, 175, 200, 60])
    ch_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("GRID", (0, 0), (-1, -1), 0.5, border_color),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ])
    )
    elements.append(ch_table)
    elements.append(Spacer(1, 14))

    # 5. Application URLs & Self-Registration
    elements.append(Paragraph("4. Quick Reference & Endpoints", h1_style))

    ref_data = [
        [
            Paragraph("<b>Frontend Web Application</b>", body_style),
            Paragraph("<b>http://localhost:5173</b> (Vite React + TypeScript + Tailwind)", code_style),
        ],
        [
            Paragraph("<b>Backend API & Interactive Docs</b>", body_style),
            Paragraph("<b>http://localhost:8000/api/v1/docs</b> (FastAPI Swagger UI)", code_style),
        ],
        [
            Paragraph("<b>Alternative ReDoc API Specs</b>", body_style),
            Paragraph("<b>http://localhost:8000/api/v1/redoc</b>", code_style),
        ],
        [
            Paragraph("<b>Local Blockchain JSON-RPC</b>", body_style),
            Paragraph("<b>http://127.0.0.1:8545</b> (Hardhat Ethereum EVM node)", code_style),
        ],
        [
            Paragraph("<b>Creating New Custom Accounts</b>", body_style),
            Paragraph(
                "Click <b>Sign In</b> on navbar &gt; Select <b>Register (ನೋಂದಣಿ)</b>.<br/>"
                "Password requirements: At least 8 characters, 1 uppercase, 1 lowercase, 1 digit, 1 symbol (e.g. <b>TestPass123!</b>).",
                body_style,
            ),
        ],
    ]

    ref_table = Table(ref_data, colWidths=[160, 370])
    ref_table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("GRID", (0, 0), (-1, -1), 0.5, border_color),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f8fafc")),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ])
    )
    elements.append(ref_table)
    elements.append(Spacer(1, 12))

    # Footer note
    footer_text = Paragraph(
        "<i>Generated by FarmConnect AI System Engineering Team • Confidential & Authorized Evaluation Reference Only.</i>",
        subtitle_style,
    )
    elements.append(footer_text)

    # Build PDF
    doc.build(elements)
    print(f"PDF generated successfully: {output_filename}")

if __name__ == "__main__":
    create_credentials_pdf()
