document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM fully loaded and parsed');

    // DOM 元素
    const elements = {
        foodInput: document.getElementById('foodInput'),
        foodImageInput: document.getElementById('foodImageInput'),
        uploadBtn: document.getElementById('uploadBtn'),
        analyzeBtn: document.getElementById('analyzeBtn'),
        fileNameDisplay: document.getElementById('fileNameDisplay'),
        loadingIndicator: document.getElementById('loadingIndicator'),
        errorMsg: document.getElementById('errorMsg'),
        analysisOutput: document.getElementById('analysisOutput')
    };

    let selectedFile = null;

    // 上传按钮事件
    elements.uploadBtn.addEventListener('click', () => elements.foodImageInput.click());

    elements.foodImageInput.addEventListener('change', (e) => {
        selectedFile = e.target.files[0] || null;
        elements.fileNameDisplay.textContent = selectedFile ? `已选择: ${selectedFile.name}` : '';
        clearError();
        e.target.value = ''; // 重置以允许重复选择同一文件
    });

    // 分析按钮事件
    elements.analyzeBtn.addEventListener('click', handleAnalysis);

    // 主分析函数
    async function handleAnalysis() {
        const foodText = elements.foodInput.value.trim();

        // 输入验证
        if (!foodText && !selectedFile) {
            showError('请输入食物描述或上传图片进行分析！');
            return;
        }

        // 准备请求
        clearResultsAndMessages();
        showLoading(true);
        toggleButtons(true);

        try {
            const formData = new FormData();
            
            if (foodText) formData.append('food_text', foodText);
            if (selectedFile) formData.append('food_image', selectedFile, selectedFile.name);

            const apiUrl = getApiUrl();
            console.log('请求的API URL:', apiUrl);

            const response = await fetch(apiUrl, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw await handleErrorResponse(response);

            const data = await response.json();
            displayAnalysisResult(data);
        } catch (error) {
            console.error('分析出错:', error);
            showError(`分析失败: ${error.message}`);
            clearResults();
        } finally {
            showLoading(false);
            toggleButtons(false);
        }
    }

    // 获取API URL
    function getApiUrl() {
        // 这里需要替换为生产环境的后端URL
        return 'https://你的生产环境域名/analyze'; // 替换为后端服务器地址
    }

    async function handleErrorResponse(response) {
        let errorDetail = `请求失败，状态码: ${response.status}`;
        try {
            const errorJson = await response.json();
            errorDetail = errorJson.error || errorDetail;
        } catch (e) {
            errorDetail = `${errorDetail} (${response.statusText || '无法获取错误详情'})`;
        }
        return new Error(errorDetail);
    }

    function toggleButtons(disabled) {
        elements.analyzeBtn.disabled = disabled;
        elements.uploadBtn.disabled = disabled;
    }

    function showLoading(isLoading) {
        elements.loadingIndicator.style.display = isLoading ? 'block' : 'none';
    }

    function showError(message) {
        elements.errorMsg.textContent = message;
        elements.errorMsg.style.display = 'block';
        if (elements.analysisOutput) elements.analysisOutput.style.display = 'none';
    }

    function clearError() {
        elements.errorMsg.textContent = '';
        elements.errorMsg.style.display = 'none';
    }

    function clearResults() {
        if (elements.analysisOutput) {
            elements.analysisOutput.innerHTML = '';
            elements.analysisOutput.style.display = 'none';
        }
    }

    function clearResultsAndMessages() {
        clearResults();
        clearError();
        showLoading(false);
    }

    function displayAnalysisResult(data) {
        if (!elements.analysisOutput) {
            console.error('错误：找不到 analysisOutput 元素！');
            showError('页面结构错误，无法显示结果。');
            return;
        }
        if (!data) {
            showError('未能获取有效的分析结果。');
            elements.analysisOutput.style.display = 'none';
            return;
        }

        let outputHTML = '';

        if (data.analysis_type === 'text') {
            const escapedText = data.text_result
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
            outputHTML = `<pre style="white-space: pre-wrap; word-wrap: break-word;">${escapedText || '未能获取有效分析结果。'}</pre>`;
        } else {
            const potential = data.potential || '未知风险';
            const reason = data.reason || '暂无分析说明。';
            const calorie = data.calorie_comparison || null;
            const suggestions = data.suggestions || [];
            const tips = data.tips || null;

            let riskColor = 'gray';
            let riskText = potential;

            const potentialLower = String(potential).toLowerCase();
            if (potentialLower.includes('高')) riskColor = 'var(--danger-color, red)';
            else if (potentialLower.includes('中')) riskColor = 'var(--warning-color, orange)';
            else if (potentialLower.includes('低') && !potentialLower.includes('未知')) riskColor = 'var(--success-color, green)';

            outputHTML = `
                <h3 style="color: ${riskColor}; margin-top: 0; font-weight: bold;">${riskText}</h3>
                <p><strong>分析：</strong> ${reason}</p>
            `;

            if (calorie) outputHTML += `<p><strong>热量对比：</strong> ${calorie}</p>`;
            if (suggestions.length > 0) {
                outputHTML += `
                    <p style="margin-top: 1em;"><strong>健康建议：</strong></p>
                    <ul style="padding-left: 20px; margin-top: 0.5em;">${suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}</ul>
                `;
            } else {
                outputHTML += `<p style="margin-top: 1em;"><strong>健康建议：</strong> 暂无具体建议。</p>`;
            }
            if (tips) outputHTML += `<p style="margin-top: 1em;"><strong>小提示：</strong> ${tips}</p>`;
        }

        elements.analysisOutput.innerHTML = outputHTML;
        elements.analysisOutput.style.display = 'block';
        elements.analysisOutput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    clearResultsAndMessages();
});
