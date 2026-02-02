import customtkinter as ctk
from tkinter import filedialog, messagebox
import os 
from datetime import datetime
import uuid 
import re
import pandas as pd

#tách từng phần theo dấu : có ký tự liền kề phía sau - NEW
def split_by_colon_segments(text):
    positions = []

    # Tìm tất cả dấu `:`
    for match in re.finditer(r":", text):
        colon_pos = match.start()
        # Kiểm tra ký tự sau dấu `:`, nếu không phải dấu cách → hợp lệ
        if colon_pos + 1 < len(text) and not text[colon_pos + 1].isspace():
            positions.append(colon_pos)

    segments = []

    if not positions:
        return [text.strip()]

    # Đoạn đầu tiên (trước dấu `:` đầu tiên)
    segments.append(text[:positions[0]].strip())

    for i in range(len(positions)):
        start = positions[i] + 1  # Bỏ dấu `:`
        end = positions[i + 1] if i + 1 < len(positions) else len(text)
        segment = text[start:end].strip()

        # Nếu là phần cuối cùng → chỉ lấy từ đầu tiên trước khoảng trắng
        if i == len(positions) - 1:
            segment = segment.split()[0]

        segments.append(segment)

    return segments

# Hàm chọn file Excel
def select_file():
    file_path = filedialog.askopenfilename(filetypes=[("Excel files", "*.xlsx;*.xls")])
    if file_path:
        entry_file.delete(0, "end")
        entry_file.insert(0, file_path)

# Hàm chọn file TXT
def select_txt_file():
    file_path = filedialog.askopenfilename(filetypes=[("Text files", "*.txt")])
    if file_path:
        entry_txt.delete(0, "end")
        entry_txt.insert(0, file_path)

def parse_txt_to_dict(file_path):
    result = {}
    with open(file_path, 'r', encoding='utf-8') as file:
        for line in file:
            # Bỏ khoảng trắng đầu/cuối dòng
            line = line.strip()
            if not line:
                continue  # Bỏ qua dòng trống

            # Tách theo dấu cách đầu tiên
            parts = line.split(' ', 1)
            if len(parts) == 2:
                key, value = parts
                result[key] = value
            else:
                print(f"Dòng không hợp lệ: {line}")

    return result

def remove_trailing_number_group(text):
    # Tìm và xóa phần "/số" ở cuối chuỗi
    return re.sub(r'/\d+$', '', text)

def extract_last_number(text):
    match = re.search(r'/(\d+)$', text.strip())
    if match:
        return match.group(1)
    return None


#def transform_text_general(lines):
def transform_text_general(lines):
    if not lines:
        return [""]
    # Lấy từ đầu tiên của dòng đầu tiên và dòng cuối cùng
    first_q = lines[0].split()[2]  # Từ thứ 3 của dòng đầu tiên
    last_q = lines[-1].split()[2]  # Từ thứ 3 của dòng cuối cùng

    # Tạo danh sách kết quả
    result = [f"Val lab {first_q} to {last_q}"]

    # Xử lý từng dòng trong danh sách
    for line in lines:
        match = re.match(r"Val lab (\S+) (\d+)\"(.+)\"", line)
        if match:
            ques, num, text = match.groups()
            result.append(f"{num}\"{text}\"")  # Thêm vào danh sách thay vì cộng chuỗi
    result[-1] += "."
    return result  
# Hàm xử lý file
def process_file():
    file_path = entry_file.get()
    txt_path = entry_txt.get()
    if not file_path:
        messagebox.showwarning("Cảnh báo", "Vui lòng chọn file Excel trước!")
        return

    # Khởi tạo mặc định rỗng
    txt_option_key_value = {}

    if txt_path:
    # Nếu có đường dẫn, thì đọc dữ liệu từ file
        txt_option_key_value = parse_txt_to_dict(txt_path)

    try:

        string_var87 = """
Recode var87(10400=1) into var87.
Recode var87(10401=2) into var87.
Recode var87(10402=3) into var87.
Recode var87(10403=4) into var87.
Recode var87(10404=5) into var87.
Recode var87(10405=6) into var87.
Recode var87(10406=7) into var87.
Recode var87(10407=8) into var87.
Recode var87(10408=9) into var87.
Recode var87(10409=10) into var87.
Recode var87(10410=11) into var87.
Recode var87(10411=12) into var87.
Recode var87(10412=13) into var87.
Recode var87(10413=14) into var87.
Recode var87(10414=15) into var87.
Recode var87(10415=16) into var87.
Recode var87(10416=17) into var87.
Recode var87(10417=18) into var87.
Recode var87(10418=19) into var87.
Recode var87(10419=20) into var87.
Recode var87(10420=21) into var87.
Recode var87(10421=22) into var87.
Recode var87(10422=23) into var87.
Recode var87(10423=24) into var87.
Recode var87(10424=25) into var87.
Recode var87(10425=26) into var87.
Recode var87(10426=27) into var87.
Recode var87(10427=28) into var87.
Recode var87(10428=29) into var87.
Recode var87(10429=30) into var87.
Recode var87(10430=31) into var87.
Recode var87(10431=32) into var87.
Recode var87(10432=33) into var87.
Recode var87(10433=34) into var87.
Recode var87(10434=35) into var87.
Recode var87(10435=36) into var87.
Recode var87(10436=37) into var87.
Recode var87(10437=38) into var87.
Recode var87(10438=39) into var87.
Recode var87(10439=40) into var87.
Recode var87(10440=41) into var87.
Recode var87(10441=42) into var87.
Recode var87(10442=43) into var87.
Recode var87(10443=44) into var87.
Recode var87(10444=45) into var87.
Recode var87(10445=46) into var87.
Recode var87(10446=47) into var87.
Recode var87(10447=48) into var87.
Recode var87(10448=49) into var87.
Recode var87(10449=50) into var87.
Recode var87(10450=51) into var87.
Recode var87(10451=52) into var87.
Recode var87(10452=53) into var87.
Recode var87(10453=54) into var87.
Recode var87(10454=55) into var87.
Recode var87(10455=56) into var87.
Recode var87(10456=57) into var87.
Recode var87(10457=58) into var87.
Recode var87(10458=59) into var87.
Recode var87(10459=60) into var87.
Recode var87(10460=61) into var87.
Recode var87(10461=62) into var87.
Recode var87(10462=63) into var87.

RENAME VARIABLES    var87=City.
val lab City
1'An Giang'
2'Bà Rịa Vũng Tàu'
3'Bắc Giang'
4'Bắc Kạn'
5'Bạc Liêu'
6'Bắc Ninh'
7'Bến Tre'
8'Bình Định'
9'Bình Dương'
10'Bình Phước'
11'Bình Thuận'
12'Cà Mau'
13'Cần Thơ'
14'Cao Bằng'
15'Đà Nẵng'
16'Đắk Lắk'
17'Đắk Nông'
18'Điện Biên'
19'Đồng Nai'
20'Đồng Tháp'
21'Gia Lai'
22'Hà Giang'
23'Hà Nam'
24'Hà Nội'
25'Hà Tĩnh'
26'Hải Dương'
27'Hải Phòng'
28'Hậu Giang'
29'Hồ Chí Minh'
30'Hòa Bình'
31'Hưng Yên'
32'Khánh Hòa'
33'Kiên Giang'
34'Kon Tum'
35'Lai Châu'
36'Lâm Đồng'
37'Lạng Sơn'
38'Lào Cai'
39'Long An'
40'Nam Định'
41'Nghệ An'
42'Ninh Bình'
43'Ninh Thuận'
44'Phú Thọ'
45'Phú Yên'
46'Quảng Bình'
47'Quảng Nam'
48'Quảng Ngãi'
49'Quảng Ninh'
50'Quảng Trị'
51'Sóc Trăng'
52'Sơn La'
53'Tây Ninh'
54'Thái Bình'
55'Thái Nguyên'
56'Thanh Hóa'
57'Thừa Thiên Huế'
58'Tiền Giang'
59'Trà Vinh'
60'Tuyên Quang'
61'Vĩnh Long'
62'Vĩnh Phúc'
63'Yên Bái'.
"""             
        # Lấy thư mục chứa file Excel
        excel_dir = os.path.dirname(file_path)

        # # Tạo tên file TXT mới
        # random_name = f"output_{uuid.uuid4().hex[:8]}.txt"  # VD: output_a1b2c3d4.txt
        # output_file = os.path.join(excel_dir, random_name)

        #Phần code để tạo tên file = tên file excel + timestamp
        base_name = os.path.splitext(os.path.basename(file_path))[0]
        # Lấy thời gian hiện tại để tạo tên file duy nhất
        time_str = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        # Tạo tên file TXT mới
        output_filename = f"{base_name}_{time_str}.txt"
        # Tạo đường dẫn đầy đủ
        output_file = os.path.join(excel_dir, output_filename)

        # Giả lập xử lý file (Bạn thay bằng code xử lý của mình)
        output_txt = f"Kết quả xử lý từ file: {file_path}"

        def extract_pn_values(pn_raw):
            # Chỉ lấy phần số cuối cùng của PN
            pn_match = re.search(r'PN(\d+(?:_\d+)*)$', pn_raw)
            if pn_match:
                return "R" + pn_match.group(1).split("_")[-1]
            return ""


        def classify_excel(file_path, output_txt):
            #df = pd.read_excel(file_path, skiprows=1)  # Bỏ dòng đầu tiên
            df = pd.read_excel(file_path,header=None)
            group_counts = {}
            subgroup_counts = {}
            subgroup_item_counts = {}
            rank_mapping = {}
            sum_mapping = {}
            result_dict = {}
            ordered_results = []
            q_r_mapping = {}
            pn_mapping = {}
            r_value_mapping = {}
            question_id = {}
            answer_order_map = {}
            answer_order_map_2 = {}
            ordered_results_2 = []
            text = {}
            text2 = {}
            matches_colon = {}
            ordered_results_loop = []
            ordered_results_loop.append(" ")
            ordered_results_loop.append("*Sửa tay phần var lab .")
            recode_ma = []
            recode_ma_val = []
            previous_question = None
            transfrom_text = []       
            
            for index, row in df.iterrows():
                col1 = str(row.iloc[0])
                col2 = str(row.iloc[1]).strip()
                
                #matches = re.findall(r':(?!\s)(_?\w+)', col2)   #cái cũ
                #thu nghiem ngay đoạn này
                matches = split_by_colon_segments(col2) #cái mới
                # matches_2 = re.findall(r':\s*([^:]+):\s*([A-Za-z]\S*)', col2)
                #matches_2 = re.findall(r':(?!\s)(_?\w+):(?!\s)(_?\w+)', col2)
                match_rank = re.search(r':(\S+)', col2) if "[Rank]" in col2 else None
                match_sum = re.search(r':(\S+)', col2) if "[Sum]" in col2 else None
                if re.fullmatch(r'var\d+', col1) and len(matches) == 2:
                    question = matches[1]
                    if question not in group_counts:
                        group_counts[question] = 1
                    else:
                        group_counts[question] += 1

                    result = f"{question}_{group_counts[question]}"
                    result_dict[col1] = result  # Lưu lại để xử lý Othr sau
                    ordered_results.append(f"Rename Variables {col1} = {result}.")
                
                elif re.fullmatch(r'var\d+O\d+', col1) and match_rank and not match_sum:

                    first_word = match_rank.group(1)
                    text = col2[:re.search(r':(\S+)',col2).start()]

                    if first_word not in rank_mapping:
                        rank_mapping[first_word] = 1
                    else:
                        rank_mapping[first_word] += 1

                    result = f"{first_word}_{rank_mapping[first_word]}"
                    result_dict[col1] = result
                    ordered_results.append(f"Rename Variables {col1} = {result}.")
                    ordered_results_2.append(f"Var lab {result}\"{first_word}. {text}\".")

                    #them val lab cho ranking
                    #recode_ma_val.append(f"Val lab {result} {rank_mapping[first_word]}'{text}'.")
                    recode_ma_val.append(f"Val lab {result} {rank_mapping[first_word]}\"Rank {rank_mapping[first_word]}\".")
                    stay_question = f"{first_word}"
                    if previous_question != stay_question:
                        recode_ma_val.pop()
                        transfrom_text = transform_text_general(recode_ma_val)
                        recode_ma.extend(transfrom_text)
                        recode_ma_val = []
                        previous_question = stay_question
                        recode_ma_val.append(f"Val lab {result} {rank_mapping[first_word]}\"Rank {rank_mapping[first_word]}\".")
                
                elif re.fullmatch(r'var\d+O\d+', col1) and match_sum and not match_rank:

                    first_word = match_sum.group(1)
                    text = col2[:re.search(r':(\S+)',col2).start()]

                    if first_word not in sum_mapping:
                        sum_mapping[first_word] = 1
                    else:
                        sum_mapping[first_word] += 1

                    result = f"{first_word}_{sum_mapping[first_word]}"
                    result_dict[col1] = result
                    ordered_results.append(f"Rename Variables {col1} = {result}.")
                    ordered_results_2.append(f"Var lab {result}\"{first_word}. {text}\".")
                    
                
                elif re.fullmatch(r'var\d+', col1):
                    first_word_match = re.search(r'\S+', col2)
                    first_word = first_word_match.group(0) if first_word_match else "Unknown"
                    result = f"{first_word}"
                    result_dict[col1] = result
                    ordered_results.append(f"Rename Variables {col1} = {result}.")

                elif re.fullmatch(r'var\d+O\d+', col1) and len(matches)==3:  
                    # matches_2 = re.findall(r':\s*([^:]+):\s*([A-Za-z]\S*)', col2)  
                    # subgroup, question = matches_2[0]  # Lấy cặp đầu tiên
                    matches_2 = split_by_colon_segments(col2)
                    subgroup = matches_2[1]  # Lấy phần thứ hai sau dấu `:`
                    question = matches_2[2]  # Lấy phần thứ ba sau dấu `:`
                    if question not in r_value_mapping:
                        r_value_mapping[question] = {}
                    if subgroup not in r_value_mapping[question]:
                        r_value_mapping[question][subgroup] = len(r_value_mapping[question]) + 1

                    r_value = r_value_mapping[question][subgroup]

                    if question not in subgroup_item_counts:
                        subgroup_item_counts[question] = {}
                    if r_value not in subgroup_item_counts[question]:
                        subgroup_item_counts[question][r_value] = 1  
                    else:
                        subgroup_item_counts[question][r_value] += 1

                    
                    result = f"{question}_{r_value}R{subgroup_item_counts[question][r_value]}"
                    result_dict[col1] = result
                    ordered_results.append(f"Rename Variables {col1} = {result}.")
                    matches_colon = re.split(r':(\S[^:]*)', col2)
                    text = matches_colon[0]
                    text2 = matches_colon[1]
                    ordered_results_2.append(f"Var lab {result}\"{question}_{r_value}. {text2}_{text}\".")
                    recode_ma.append(f"Recode {result}(0=sysmis)(1={subgroup_item_counts[question][r_value]}) into {result}.")
                    recode_ma_val.append(f"Val lab {result} {subgroup_item_counts[question][r_value]}\"{text2}_{text}\".")
                    
                    #val lab
                    stay_question = f"{question}_{r_value}"
                    if previous_question != stay_question:
                        recode_ma.pop()
                        recode_ma_val.pop()
                        transfrom_text = transform_text_general(recode_ma_val)
                        recode_ma.extend(transfrom_text)
                        recode_ma_val = []
                        previous_question = stay_question
                        recode_ma.append(f"Recode {result}(0=sysmis)(1={subgroup_item_counts[question][r_value]}) into {result}.")
                        recode_ma_val.append(f"Val lab {result} {subgroup_item_counts[question][r_value]}\"{text2}_{text}\".")
                elif re.fullmatch(r'var\d+O\d+', col1) and len(matches)==2 and len(matches)!=3 and not match_sum and not match_rank:

                    question = matches[1]
                    
                    if question not in q_r_mapping:
                        q_r_mapping[question] = 1
                    else:
                        q_r_mapping[question] += 1  
                    
                    result = f"{question}R{q_r_mapping[question]}"
                    result_dict[col1] = result
                    ordered_results.append(f"Rename Variables {col1} = {result}.")
                    matches_colon = re.split(r':(\S[^:]*)', col2)
                    text = matches_colon[0]
                    ordered_results_2.append(f"Var lab {result}\"{question}. {text}\".")
                    
                    recode_ma.append(f"Recode {result}(0=sysmis)(1={q_r_mapping[question]}) into {result}.")
                    recode_ma_val.append(f"Val lab {result} {q_r_mapping[question]}\"{text}\".")
                    stay_question = f"{question}"
                    if previous_question != stay_question:
                        recode_ma.pop()
                        recode_ma_val.pop()
                        transfrom_text = transform_text_general(recode_ma_val)
                        recode_ma.extend(transfrom_text)
                        recode_ma_val = []
                        previous_question = stay_question
                        recode_ma.append(f"Recode {result}(0=sysmis)(1={q_r_mapping[question]}) into {result}.")
                        recode_ma_val.append(f"Val lab {result} {q_r_mapping[question]}\"{text}\".")
                
                elif re.fullmatch(r'var\d+O\d+(?:Othr)?PN[\d_]+', col1):
                    match = re.match(r"(var\d+)(O\d+)(Othr)?(PN[\d_]+)$", col1)
                    if match:
                        var_id, option_id, othr_flag, pn_raw = match.groups()

                    match_question = re.search(r":(\S+)", col2)
                    if match_question:
                        question = match_question.group(1)

                    # Tìm tất cả các PN\d trong col1
                    pn_numbers = re.findall(r'PN(\d+(?:_\d+)*)', col1)
                    if pn_numbers:
                        sub_question = "_" + pn_numbers[0].split("_")[-1]
                    else:
                        sub_question = "_"
                    if (question, sub_question, option_id) in answer_order_map:
                        answer_order = answer_order_map[(question, sub_question, option_id)]
                    else:
                        if (question, sub_question) in q_r_mapping:
                            q_r_mapping[(question, sub_question)] += 1
                        else:
                            q_r_mapping[(question, sub_question)] = 1
                    
                        answer_order = q_r_mapping[(question, sub_question)]
                        answer_order_map[(question, sub_question, option_id)] = answer_order

                    matches_colon = re.split(r':(\S[^:]*)', col2)
                    text = matches_colon[0]

                    if othr_flag:
                        result = f"{question}{sub_question}R{answer_order}_99"
                        match_3 = re.match(r"(var\d+)(O\d+)(Othr)(PN[\d_]+)$", col1)
                        if match_3:
                            # ordered_results_loop.append(f"Var lab {result}\"{question}. ??_{text}\".")
                            if len(txt_option_key_value)>0:
                                for key, value in txt_option_key_value.items():
                                    if sub_question != "_":
                                        if pn_numbers[0].split("_")[-1]==key:
                                            ordered_results_loop.append(f"Var lab {result}\"{question}. {txt_option_key_value[key]}_{text}\".")
                                            break      
                            else:    
                                ordered_results_loop.append(f"Var lab {result}\"{question}. ??_{text}\".")
                            
                    else:
                        result = f"{question}{sub_question}R{answer_order}"
                        # ordered_results_loop.append(f"Var lab {result}\"{question}. ??_{text}\".")
                        if len(txt_option_key_value)>0:
                                for key, value in txt_option_key_value.items():
                                    if sub_question !="_":
                                        if pn_numbers[0].split("_")[-1]==key:
                                            ordered_results_loop.append(f"Var lab {result}\"{question}. {txt_option_key_value[key]}_{text}\".")
                                            break    
                        else:    
                            ordered_results_loop.append(f"Var lab {result}\"{question}. ??_{text}\".")
                        recode_ma.append(f"Recode {result}(0=sysmis)(1={answer_order}) into {result}.")
                        recode_ma_val.append(f"Val lab {result} {answer_order}\"{text}\".")
                
                    ordered_results.append(f"Rename Variables {col1} = {result}.")
                    stay_question = f"{question}{sub_question}"
                    if previous_question != stay_question:
                        if not othr_flag:
                            recode_ma.pop()
                            recode_ma_val.pop()
                            transfrom_text = transform_text_general(recode_ma_val)
                            recode_ma.extend(transfrom_text)
                            recode_ma_val = []
                            previous_question = stay_question
                            recode_ma.append(f"Recode {result}(0=sysmis)(1={answer_order}) into {result}.")
                            recode_ma_val.append(f"Val lab {result} {answer_order}\"{text}\".")    

                elif re.fullmatch(r'var(\d+)PN(\d+)', col1):
                    # match_pn = re.match(r'var(\d+)PN(\d+)', col1)
                    # var_id, pn_id = match_pn.groups()
                    # match_question = re.search(r'^(\S+)', col2)
                    # if match_question:
                    #     question = match_question.group(1)
                    #     result = f"{question}_{pn_id}"
                    #     ordered_results.append(f"Rename Variables {col1} = {result}.")
                    temp=split_by_colon_segments(col2)
                    if len(temp)==1:
                        match_pn = re.match(r'var(\d+)PN(\d+)', col1)
                        var_id, pn_id = match_pn.groups()
                        match_question = re.search(r'^(\S+)', col2)
                        if match_question:
                            question = match_question.group(1)
                            result = f"{question}_{pn_id}"
                            ordered_results.append(f"Rename Variables {col1} = {result}.")
                    if len(temp)==2:
                        match = re.match(r"(var\d+)(PN[\d_]+)$", col1)
                        if match:
                            var_id, pn_raw = match.groups()

                        question = temp[1]
                        sub_question = remove_trailing_number_group(temp[0])

                        pn_now = extract_last_number(temp[0])

                        # Tìm tất cả các PN\d trong col1
                        # pn_numbers = re.findall(r'PN(\d+(?:_\d+)*)', col1)
                        # if pn_numbers:
                        #     sub_question = "_" + pn_numbers[0].split("_")[-1]
                        # else:
                        #     sub_question = "_"
                        # if (question, sub_question) in answer_order_map:
                        #     answer_order = answer_order_map[(question, sub_question)]
                        # else:
                        #     if (question, sub_question) in q_r_mapping:
                        #         q_r_mapping[(question, sub_question)] += 1
                        #     else:
                        #         q_r_mapping[(question, sub_question)] = 1
                        
                        #     answer_order = q_r_mapping[(question, sub_question)]
                        #     answer_order_map[(question, sub_question)] = answer_order
                        stay_question = f"{question}"
                        if previous_question != stay_question:
                            previous_question = f"{question}"
                            pn_mapping = {}
                            q_r_mapping = {}


                        if sub_question not in pn_mapping:
                            pn_mapping[sub_question] = len(pn_mapping) + 1
                        if sub_question not in q_r_mapping:
                            q_r_mapping[sub_question] = 1
                        else:
                            q_r_mapping[sub_question] += 1
                        answer_order = q_r_mapping[sub_question]
                        answer_order_map[(question, sub_question)] = answer_order
                        answer_order_2 = pn_mapping[sub_question]
                        answer_order_map_2[(question, sub_question)] = answer_order_2

                        text= temp[0]
                                
                        pn_id = extract_last_number(temp[0])
                        result = f"{question}_{answer_order_2}_{answer_order}"
                        ordered_results.append(f"Rename Variables {col1} = {result}.")
                        # ordered_results_loop.append(f"Var lab {result}\"{question}. ??_{text}\".")
                        if len(txt_option_key_value)>0:
                            for key, value in txt_option_key_value.items():  
                                if pn_now==key:
                                    ordered_results_loop.append(f"Var lab {result}\"{question}. {txt_option_key_value[key]}_{text}\".")
                                    break    
                        else:    
                            ordered_results_loop.append(f"Var lab {result}\"{question}. ??_{text}\".")
                    

                # elif re.fullmatch(r'var\d+QN\d+', col1) and ':' in col2 :
                #     match = re.search(r'(\d+):[^:]+:([^ ]+)', col2)
                #     if match:
                #         record_id, question_id = match.groups()
                #         result = f"{question_id}_{record_id}."
                #         result_dict[col1] = result
                #         ordered_results.append(f"Rename Variables {col1} = {result}")
                # Phần này viết cho cả MA loop sẽ check lại, đang code dựa vào elif ngay trên dòng 457
                elif re.fullmatch(r'var\d+QN\d+', col1) and ':' in col2:
                    temp=split_by_colon_segments(col2)
                    if len(temp)==2:
                        record_id = temp[0]
                        question_id = temp[1]
                        result = f"{question_id}_{record_id}"
                        result_dict[col1] = result
                        ordered_results.append(f"Rename Variables {col1} = {result}.")
                        # ordered_results_loop.append(f"Var lab {result}\"{col2}\".")
                        if len(txt_option_key_value)>0:
                            for key, value in txt_option_key_value.items():   
                                if record_id == key:
                                    ordered_results_loop.append(f"Var lab {result}\"{question_id}. {txt_option_key_value[key]}_{text}\".")
                                    break
                        else:    
                            ordered_results_loop.append(f"Var lab {result}\"{col2}\".")
                        
                    elif len(temp)==3:
                        record_id = temp[0]
                        question_id = temp[2]
                        result = f"{question_id}_{record_id}"
                        result_dict[col1] = result
                        ordered_results.append(f"Rename Variables {col1} = {result}.")
                        # ordered_results_loop.append(f"Var lab {result}\"{col2}\".")
                        if len(txt_option_key_value)>0:
                                for key, value in txt_option_key_value.items():
                                    if record_id == key:
                                        ordered_results_loop.append(f"Var lab {result}\"{question_id}. {txt_option_key_value[key]}_{text}\".")
                                        break    
                        else:    
                            ordered_results_loop.append(f"Var lab {result}\"{col2}\".")

                elif re.fullmatch(r'var\d+O\d+QN\d+', col1):
                    match = re.match(r"(var\d+)(O\d+)(Othr)?(QN[\d_]+)$", col1)
                    if match:
                        var_id, option_id, othr_flag, pn_raw = match.groups()

                    # match_question = re.search(r":(\S+)", col2)
                    # if match_question:
                    #     question = match_question.group(1)
                    match_question = split_by_colon_segments(col2)
                    question= match_question[2]

                    # Tìm tất cả các QN\d trong col1
                    pn_numbers = re.findall(r'QN(\d+(?:_\d+)*)', col1)
                    if pn_numbers:
                        sub_question = "_" + pn_numbers[0].split("_")[-1]
                    else:
                        sub_question = "_"
                    if (question, sub_question, option_id) in answer_order_map:
                        answer_order = answer_order_map[(question, sub_question, option_id)]
                    else:
                        if (question, sub_question) in q_r_mapping:
                            q_r_mapping[(question, sub_question)] += 1
                        else:
                            q_r_mapping[(question, sub_question)] = 1
                    
                        answer_order = q_r_mapping[(question, sub_question)]
                        answer_order_map[(question, sub_question, option_id)] = answer_order

                    matches_colon = re.split(r':(\S[^:]*)', col2)
                    text = matches_colon[0]

                    if othr_flag:
                        result = f"{question}{sub_question}R{answer_order}_99"
                        match_3 = re.match(r"(var\d+)(O\d+)(Othr)(QN[\d_]+)$", col1)
                        if match_3:
                            # ordered_results_loop.append(f"Var lab {result}\"{question}. ??_{text}\".")
                            if len(txt_option_key_value)>0:
                                for key, value in txt_option_key_value.items():
                                    if sub_question != "_":
                                        if pn_numbers[0].split("_")[-1]==key:
                                            ordered_results_loop.append(f"Var lab {result}\"{question}. {txt_option_key_value[key]}_{text}\".")
                                            break
                            else:    
                                ordered_results_loop.append(f"Var lab {result}\"{question}. ??_{text}\".")
                    else:
                        result = f"{question}{sub_question}R{answer_order}"
                        # ordered_results_loop.append(f"Var lab {result}\"{question}. ??_{text}\".")
                        if len(txt_option_key_value)>0:
                                for key, value in txt_option_key_value.items():
                                    if sub_question !="_":
                                        if pn_numbers[0].split("_")[-1]==key:
                                            ordered_results_loop.append(f"Var lab {result}\"{question}. {txt_option_key_value[key]}_{text}\".")
                                            break
                        else:    
                            ordered_results_loop.append(f"Var lab {result}\"{question}. ??_{text}\".")
                        recode_ma.append(f"Recode {result}(0=sysmis)(1={answer_order}) into {result}.")
                        recode_ma_val.append(f"Val lab {result} {answer_order}\"{text}\".")
                
                    ordered_results.append(f"Rename Variables {col1} = {result}.")
                    stay_question = f"{question}{sub_question}"
                    if previous_question != stay_question:
                        if not othr_flag:
                            recode_ma.pop()
                            recode_ma_val.pop()
                            transfrom_text = transform_text_general(recode_ma_val)
                            recode_ma.extend(transfrom_text)
                            recode_ma_val = []
                            previous_question = stay_question
                            recode_ma.append(f"Recode {result}(0=sysmis)(1={answer_order}) into {result}.")
                            recode_ma_val.append(f"Val lab {result} {answer_order}\"{text}\".")
                else:
                    continue      

            for index, row in df.iterrows():
                text = {}
                var = str(row.iloc[0])
                var2 = str(row.iloc[1].strip())
                othr_match = re.fullmatch(r'(var\d+O\d+)Othr', var)
                othr_match_sa = re.fullmatch(r'(var\d+)(O\d+)(Othr)', var)
                

                if othr_match:
                    matches_colon = re.split(r':(\S[^:]*)', var2)
                    text = matches_colon[0]
                    match = re.match(r'^\S+', matches_colon[1])
                    if match:
                        first_word = match.group(0).strip(":")
                        base_var = othr_match.group(1)  # Lấy var đầu tiên
                        # print(base_var)
                    if base_var in result_dict:
                        base_result = result_dict[base_var].strip("'")  # Loại bỏ dấu nháy đơn nếu có

                        othr_result = f"Rename Variables {var} = {base_result}_99."
                        othr_result_2 = f"Var lab {base_result}_99\"{first_word}. {text}\"."
                        # Chèn ngay sau biến gốc
                        index_to_insert = next((i for i, line in enumerate(ordered_results) if base_var in line), len(ordered_results))
                        ordered_results.insert(index_to_insert + 1, othr_result)
                        # Chén ngay sau biến gốc chưa _99 ở ordered_results_2
                        index_to_insert = next((i for i, line in enumerate(ordered_results_2) if base_result in line), len(ordered_results_2))
                        ordered_results_2.insert(index_to_insert + 1, othr_result_2)  
                    else: #đoạn này code mới để tìm Othr cho câu SA
                        base_var = othr_match_sa.group(1)  # Lấy var đầu tiên
                        indices =[]
                        #indices_2 = []
                        # print(base_var)
                        indices = [i for i, line in enumerate(ordered_results) if base_var in line]
                        #indices_2 = [i for i, line in enumerate(ordered_results_2) if base_var in line]
                        # print(indices)
                        # print(indices_2)
                        if indices:
                            othr_result = f"Rename Variables {var} = {first_word}_99_{len(indices)}."
                            ordered_results.insert(indices[-1] + 1, othr_result)
                            othr_result_2 = f"Var lab {first_word}_99_{len(indices)}\"{first_word}. {text}\"."
                            ordered_results_2.append(othr_result_2)
            transfrom_text = transform_text_general(recode_ma_val)
            recode_ma.extend(transfrom_text)
            with open(output_file, "w", encoding="utf-8") as f:
                f.writelines(string_var87 + "\n")
                f.writelines(line + "\n" for line in ordered_results)
                f.writelines(line + "\n" for line in ordered_results_2)
                f.writelines(line + "\n" for line in ordered_results_loop)
                f.writelines(line + "\n" for line in recode_ma)
                # f.writelines("GET FILE='spss.sav'.")
                # f.writelines("SAVE OUTFILE='spss_clean_label.sav'.")
        #file_path = "C:/Users/ASUS/OneDrive/Desktop/Base6.xlsx"
        # output_txt = "C:/Users/ASUS/OneDrive/Desktop/output_final.txt"
        classify_excel(file_path, output_file)
            
        # Hiển thị kết quả lên giao diện
        txt_output.delete("1.0", "end")
        txt_output.insert("1.0", f"File đã lưu tại: {output_file}")

        messagebox.showinfo("Thành công", f"File đã lưu tại: {output_file}")
    except Exception as e:
        messagebox.showerror("Lỗi", str(e))

# # Tạo giao diện chính
# ctk.set_appearance_mode("Light")  # Giao diện sáng
# app = ctk.CTk()
# app.title("Ứng dụng xử lý Excel")
# app.geometry("500x300")

# # Nút chọn file
# entry_file = ctk.CTkEntry(app, width=300)
# entry_file.pack(pady=10)

# btn_browse = ctk.CTkButton(app, text="Chọn file Excel", command=select_file)
# btn_browse.pack()

# # Nút xử lý
# btn_process = ctk.CTkButton(app, text="Xử lý", command=process_file)
# btn_process.pack(pady=10)

# # Hiển thị kết quả
# txt_output = ctk.CTkTextbox(app, height=100, width=400)
# txt_output.pack(pady=10)

# app.mainloop()
# --- GUI chính ---
ctk.set_appearance_mode("Light")  # Giao diện sáng
app = ctk.CTk()
app.title("Ứng dụng xử lý Excel & TXT")
app.geometry("500x400")

# Ô chọn file Excel
entry_file = ctk.CTkEntry(app, width=300)
entry_file.pack(pady=(10, 5))

btn_browse = ctk.CTkButton(app, text="Chọn file Excel", command=select_file)
btn_browse.pack()

# Ô chọn file TXT
entry_txt = ctk.CTkEntry(app, width=300)
entry_txt.pack(pady=(20, 5))

btn_browse_txt = ctk.CTkButton(app, text="Chọn file TXT", command=select_txt_file)
btn_browse_txt.pack()

# Nút xử lý
btn_process = ctk.CTkButton(app, text="Xử lý", command=process_file)
btn_process.pack(pady=20)

# Vùng hiển thị kết quả
txt_output = ctk.CTkTextbox(app, height=100, width=400)
txt_output.pack(pady=10)

app.mainloop()
